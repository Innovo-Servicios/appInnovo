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
import { CheckCircle2, CircleX, ExternalLink, FileText, ShieldCheck } from "lucide-react-native";
import * as SecureStore from "@/utils/secureStorage";
import type { Notificacion } from "@/types/interfaces";
import { aceptarNotificacion, firmarNotificacion } from "@/api/trabajador";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { AppButton, AppHeader, Field, IconButton, ModalSheet } from "@/components/ui";
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
  const { setNotificaciones } = useGlobalContext();
  const [notification, setNotification] = useState<Notificacion | null>(selectedNotification);
  const [accessToken, setAccessToken] = useState("");
  const [signatureCode, setSignatureCode] = useState("");
  const [isSigning, setSigning] = useState(false);
  const [isAccepting, setAccepting] = useState(false);

  useEffect(() => {
    setNotification(selectedNotification);
  }, [selectedNotification]);

  const isNotificationImage =
    notification?.url?.endsWith(".jpg") ||
    notification?.url?.endsWith(".jpeg") ||
    notification?.url?.endsWith(".png");

  useEffect(() => {
    SecureStore.getItemAsync("token")
      .then((token) => setAccessToken(token || ""))
      .catch(() => setAccessToken(""));
  }, []);

  const notificationAssetUrl = buildAuthenticatedAssetUrl(
    notification?.url,
    accessToken
  );

  const validation = notification?.validacion;
  const requiresValidation = Boolean(validation?.required);
  const validationState = validation?.estado || "pendiente";
  const personalCode =
    typeof validation?.codigo === "string" && /^\d{6}$/.test(validation.codigo)
      ? validation.codigo
      : null;
  const canSign = requiresValidation && validationState === "pendiente";
  const canAccept = requiresValidation && validationState === "firmado";
  const hasAccepted = requiresValidation && validationState === "aceptado";
  const isValidationClosed =
    requiresValidation &&
    (validationState === "vencido" || validationState === "bloqueado");

  const updateNotificationValidation = (nextValidation: Notificacion["validacion"]) => {
    if (!notification) return;

    const nextNotification = {
      ...notification,
      validacion: nextValidation,
    };
    setNotification(nextNotification);
    setNotificaciones((current) =>
      current.map((item) =>
        item.id === nextNotification.id ? nextNotification : item
      )
    );
  };

  const getValidationLabel = () => {
    if (!requiresValidation) return "";
    if (hasAccepted) return "Aceptado";
    if (validationState === "firmado") return "Firmado, falta aceptar";
    if (validationState === "vencido") return "Código vencido";
    if (validationState === "bloqueado") return "Código bloqueado";
    return "Firma pendiente";
  };

  const getValidationMessage = () => {
    if (!requiresValidation) return "";
    if (hasAccepted) return "La notificación ya fue firmada y aceptada.";
    if (validationState === "firmado") {
      return "Firma registrada. Presiona Acepto para completar la validación.";
    }
    if (validationState === "vencido") {
      return "El código de 6 dígitos venció. Solicita uno nuevo a administración.";
    }
    if (validationState === "bloqueado") {
      return "La validación fue bloqueada por intentos fallidos. Solicita un nuevo código.";
    }
    return personalCode
      ? "Ingresa tu código personal de 6 dígitos."
      : "Ingresa el código de 6 dígitos asignado a tu usuario.";
  };

  const handleSignatureCodeChange = (value: string) => {
    setSignatureCode(value.replace(/\D/g, "").slice(0, 6));
  };

  const handleSign = async () => {
    if (!notification || signatureCode.length !== 6) {
      Alert.alert("Código inválido", "Ingresa el código de 6 dígitos.");
      return;
    }

    setSigning(true);
    try {
      const response = await firmarNotificacion(notification.id, signatureCode);
      updateNotificationValidation(response.validacion);
      setSignatureCode("");
      Alert.alert("Firma registrada", "Ahora puedes presionar Acepto.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo firmar.";
      Alert.alert("Error", message);
    } finally {
      setSigning(false);
    }
  };

  const handleAccept = async () => {
    if (!notification) return;

    setAccepting(true);
    try {
      const response = await aceptarNotificacion(notification.id);
      updateNotificationValidation(response.validacion);
      Alert.alert("Aceptado", "La validación quedó registrada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo aceptar.";
      Alert.alert("Error", message);
    } finally {
      setAccepting(false);
    }
  };

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
    if (notification && !notification.estado && notification.tipo !== "msg") {
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

  if (!notification) {
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
          title={notification.titulo || "Notificación"}
          subtitle={notification.mensaje || undefined}
          icon={<FileText size={22} color={colors.brand} />}
        />

        {notification.contenido ? (
          <Text style={styles.contentText}>{notification.contenido}</Text>
        ) : null}

        {notification.url && isNotificationImage ? (
          <Image source={{ uri: notificationAssetUrl }} style={styles.modalImage} />
        ) : null}

        {notification.url && !isNotificationImage ? (
          <AppButton
            title="Abrir enlace"
            icon={<ExternalLink size={20} color={colors.white} />}
            onPress={async () => {
              const token = await SecureStore.getItemAsync("token");
              if (!token) {
                Alert.alert("Sesión expirada", "Vuelve a iniciar sesión para abrir el documento.");
                return;
              }
              handleOpenURL(buildAuthenticatedAssetUrl(notification.url || "", token));
            }}
          />
        ) : null}

        {requiresValidation ? (
          <View style={styles.validationBox}>
            <View style={styles.validationHeader}>
              <View style={styles.validationIcon}>
                <ShieldCheck size={20} color={colors.success} />
              </View>
              <View style={styles.validationTitleWrap}>
                <Text style={styles.validationTitle}>Validación requerida</Text>
                <Text style={styles.validationStatus}>{getValidationLabel()}</Text>
              </View>
            </View>

            <Text style={styles.validationMessage}>{getValidationMessage()}</Text>

            {validation?.expiresAt ? (
              <Text style={styles.validationMeta}>
                Vence: {new Date(validation.expiresAt).toLocaleString("es-CL")}
              </Text>
            ) : null}

            {canSign ? (
              <>
                {personalCode ? (
                  <View style={styles.personalCodeBox}>
                    <Text style={styles.personalCodeLabel}>Tu código personal</Text>
                    <Text style={styles.personalCodeValue}>{personalCode}</Text>
                  </View>
                ) : null}
                <Field
                  label="Código de firma"
                  value={signatureCode}
                  onChangeText={handleSignatureCodeChange}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  style={styles.codeInput}
                />
                <AppButton
                  title="Firmar"
                  loading={isSigning}
                  disabled={signatureCode.length !== 6}
                  icon={<ShieldCheck size={20} color={colors.white} />}
                  onPress={handleSign}
                />
              </>
            ) : null}

            {canAccept || hasAccepted ? (
              <AppButton
                title={hasAccepted ? "Aceptado" : "Acepto"}
                variant={hasAccepted ? "secondary" : "primary"}
                loading={isAccepting}
                disabled={!canAccept || hasAccepted}
                icon={<CheckCircle2 size={20} color={hasAccepted ? colors.brand : colors.white} />}
                onPress={handleAccept}
              />
            ) : null}

            {isValidationClosed ? (
              <Text style={styles.validationWarning}>
                Administración puede regenerar un nuevo código desde el panel web.
              </Text>
            ) : null}
          </View>
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
  validationBox: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.successSoft,
  },
  validationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  validationIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  validationTitleWrap: {
    flex: 1,
  },
  validationTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: "900",
  },
  validationStatus: {
    color: colors.success,
    fontSize: fontSizes.sm,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  validationMessage: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  validationMeta: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: "800",
  },
  personalCodeBox: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  personalCodeLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: "800",
  },
  personalCodeValue: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: "900",
    letterSpacing: 0,
  },
  validationWarning: {
    color: colors.warning,
    fontSize: fontSizes.sm,
    fontWeight: "800",
    textAlign: "center",
  },
  codeInput: {
    textAlign: "center",
    fontSize: fontSizes.xl,
    fontWeight: "900",
    letterSpacing: 0,
  },
});

export default ModalNotificacion;
