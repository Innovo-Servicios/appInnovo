import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CircleX, ExternalLink, FileText } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import type { Notificacion } from "@/types/interfaces";
import { AppButton, AppHeader, IconButton, ModalSheet } from "@/components/ui";
import { colors, fontSizes, radius, spacing } from "@/constants/theme";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

const buildAuthenticatedAssetUrl = (
  assetUrl?: string | null,
  accessToken?: string | null
) => {
  if (!assetUrl) {
    return "";
  }

  const cleanAssetUrl = assetUrl.trim();
  const normalizedUrl = /^https?:\/\//i.test(cleanAssetUrl)
    ? cleanAssetUrl
    : `${(apiUrl ?? "").replace(/\/+$/, "")}/${cleanAssetUrl.replace(/^\/+/, "")}`;

  if (!accessToken) {
    return normalizedUrl;
  }

  const separator = normalizedUrl.includes("?") ? "&" : "?";
  return `${normalizedUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
};

const parseNotification = (notification?: string | string[]) => {
  const raw = Array.isArray(notification) ? notification[0] : notification;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Notificacion;
  } catch {
    return null;
  }
};

const ModalNotificacion = () => {
  const params = useLocalSearchParams();
  const selectedNotification = useMemo(
    () => parseNotification(params.notification),
    [params.notification]
  );
  const [accessToken, setAccessToken] = useState("");
  const isNotificationImage =
    selectedNotification?.url?.endsWith(".jpg") ||
    selectedNotification?.url?.endsWith(".jpeg") ||
    selectedNotification?.url?.endsWith(".png");

  useEffect(() => {
    SecureStore.getItemAsync("token")
      .then((token) => setAccessToken(token || ""))
      .catch(() => setAccessToken(""));
  }, []);

  const notificationAssetUrl = buildAuthenticatedAssetUrl(
    selectedNotification?.url,
    accessToken
  );

  const handleOpenURL = (url: string) => {
    Alert.alert(
      "Aceptar términos",
      "Al abrir el enlace, aceptas la recepción de la información y declaras conocer su contenido.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Abrir",
          onPress: () =>
            Linking.openURL(url).catch((err) =>
              console.error("Error al abrir el URL:", err)
            ),
        },
      ],
      { cancelable: true }
    );
  };

  const handlerClose = () => {
    if (selectedNotification && !selectedNotification.estado && selectedNotification.tipo !== "msg") {
      Alert.alert(
        "Aceptar términos",
        "Al cerrar este mensaje, aceptas la recepción de la información y declaras conocer su contenido. ¿Deseas continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: () => router.back() },
        ],
        { cancelable: true }
      );
    } else {
      router.back();
    }
  };

  if (!selectedNotification) {
    return (
      <ModalSheet>
        <AppHeader
          title="Notificación no disponible"
          subtitle="No se pudo abrir el contenido solicitado."
          icon={<FileText size={22} color={colors.brand} />}
        />
        <AppButton title="Volver" onPress={() => router.back()} />
      </ModalSheet>
    );
  }

  return (
    <ModalSheet style={styles.sheet}>
      <View style={styles.close}>
        <IconButton
          label="Cerrar notificación"
          variant="plain"
          size={40}
          icon={<CircleX size={22} color={colors.textMuted} />}
          onPress={handlerClose}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppHeader
          title={selectedNotification.titulo || "Notificación"}
          subtitle={selectedNotification.mensaje || undefined}
          icon={<FileText size={22} color={colors.brand} />}
        />

        {selectedNotification.contenido ? (
          <Text style={styles.contentText}>{selectedNotification.contenido}</Text>
        ) : null}

        {selectedNotification.url && isNotificationImage ? (
          <Image source={{ uri: notificationAssetUrl }} style={styles.modalImage} />
        ) : null}

        {selectedNotification.url && !isNotificationImage ? (
          <AppButton
            title="Abrir enlace"
            icon={<ExternalLink size={20} color={colors.white} />}
            onPress={async () => {
              const token = await SecureStore.getItemAsync("token");
              if (!token) {
                Alert.alert("Sesión expirada", "Vuelve a iniciar sesión para abrir el documento.");
                return;
              }
              handleOpenURL(buildAuthenticatedAssetUrl(selectedNotification.url, token));
            }}
          />
        ) : null}
      </ScrollView>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "90%",
  },
  close: {
    alignItems: "flex-end",
    marginBottom: spacing.xs,
  },
  scrollViewContent: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  contentText: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    lineHeight: 23,
    textAlign: "center",
  },
  modalImage: {
    width: "100%",
    height: 280,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
});

export default ModalNotificacion;
