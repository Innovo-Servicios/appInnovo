import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "@/utils/secureStorage";
import {
  BriefcaseBusiness,
  Camera,
  CreditCard,
  FileText,
  LogOut,
  Mail,
  UserCircle,
  UserRound,
} from "lucide-react-native";
import { getPerfil, updatePerfil } from "@/api/trabajador";
import { useAuth } from "@/contexts/AuthProvider";
import type { DatoPerfil, Documento } from "@/types/interfaces";
import { AppButton, AppHeader, Badge, Card, EmptyState, InfoRow, Screen } from "@/components/ui";
import { colors, fontSizes, radius, shadows, spacing } from "@/constants/theme";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

const getCargoLabel = (cargo?: DatoPerfil["cargo"]) => {
  if (cargo === "administracion") return "Administración";
  if (cargo === "lector") return "Lector";
  if (cargo === "supervisor") return "Supervisor";
  if (cargo === "inspector") return "Inspector";
  return cargo || "-";
};

const buildProfileUrl = (perfil?: string) => {
  if (!perfil || !apiUrl) {
    return "";
  }

  const [, path] = perfil.split("/IMG_PERFILES");
  return path ? `${apiUrl}IMG_PERFILES${path}` : perfil;
};

export default function PerfilScreen() {
  const { logout } = useAuth();
  const [datosPerfil, setDatosPerfil] = useState<DatoPerfil | null>(null);
  const [imageURL, setImageURL] = useState("");
  const [isRefreshingPhoto, setRefreshingPhoto] = useState(false);

  const refreshPerfil = async () => {
    const data = await getPerfil();
    setDatosPerfil(data);
    setImageURL(buildProfileUrl(data.perfil));
  };

  const pickImageAsync = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (result.canceled) {
      return;
    }

    setRefreshingPhoto(true);
    try {
      const res = await updatePerfil(result.assets[0].uri);
      if (res) {
        setImageURL("");
        await refreshPerfil();
        await Image.clearDiskCache();
        Alert.alert("Foto actualizada", "La foto de perfil se actualizó correctamente.");
      } else {
        Alert.alert("No se pudo actualizar", "Intenta nuevamente en unos minutos.");
      }
    } finally {
      setRefreshingPhoto(false);
    }
  };

  useEffect(() => {
    refreshPerfil().catch(() => {
      Alert.alert("Error", "No se pudo cargar el perfil.");
    });
  }, []);

  const handleOpenURL = (url: string) => {
    Linking.openURL(url).catch((err) =>
      console.error("Error al abrir el URL:", err)
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Cerrar sesión",
      "¿Deseas salir de tu cuenta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar sesión",
          style: "destructive",
          onPress: () => {
            void logout();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const groupDocumentsByType = (documentos: Documento[]) => {
    return documentos.reduce((acc, doc) => {
      const type = doc.tipo.value;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(doc);
      return acc;
    }, {} as Record<string, Documento[]>);
  };

  const renderDocumentItems = () => {
    if (!datosPerfil?.documentos?.length) {
      return (
        <EmptyState
          compact
          icon={<FileText size={24} color={colors.textMuted} />}
          title="Sin documentos"
          description="Los documentos disponibles aparecerán aquí."
        />
      );
    }

    const groupedDocuments = groupDocumentsByType(datosPerfil.documentos);
    return Object.entries(groupedDocuments).map(([type, docs]) => {
      if (type === "Notificacion") return null;
      return (
        <View key={type} style={styles.documentGroup}>
          <Text style={styles.documentTypeTitle}>{type}</Text>
          {docs.map((doc) => (
            <Pressable
              key={doc._id}
              style={({ pressed }) => [styles.documentItem, pressed && styles.pressed]}
              onPress={async () => {
                const token = await SecureStore.getItemAsync("token");
                if (!token) {
                  Alert.alert("Sesión expirada", "Vuelve a iniciar sesión para abrir el documento.");
                  return;
                }
                handleOpenURL(`${apiUrl}${doc.url}?access_token=${encodeURIComponent(token)}`);
              }}
            >
              <View style={styles.documentIcon}>
                <FileText size={20} color={colors.brand} />
              </View>
              <View style={styles.documentItemContent}>
                <Text style={styles.documentText} numberOfLines={1}>
                  {doc.tipo.value}
                </Text>
                <Text style={styles.documentDate}>
                  {new Date(doc.fecha).toLocaleDateString("es-CL")}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      );
    });
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <AppHeader
        eyebrow="Cuenta"
        title="Perfil"
        subtitle="Datos personales, cargo y documentos laborales."
        icon={<UserRound size={24} color={colors.brand} />}
      />

      <Card style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          {datosPerfil?.perfil && imageURL ? (
            <Image
              style={styles.profileImage}
              source={imageURL}
              contentFit="cover"
              transition={350}
              cachePolicy="disk"
            />
          ) : (
            <View style={styles.avatarFallback}>
              <UserCircle size={92} color={colors.brand} />
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de perfil"
            style={({ pressed }) => [styles.changePhotoButton, pressed && styles.pressed]}
            onPress={pickImageAsync}
            disabled={isRefreshingPhoto}
          >
            <Camera size={22} color={colors.white} />
          </Pressable>
        </View>
        <Text style={styles.profileName} numberOfLines={2}>
          {datosPerfil?.Nombre || "Perfil trabajador"}
        </Text>
        <Badge label={getCargoLabel(datosPerfil?.cargo)} tone="brand" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Información personal</Text>
        <InfoRow
          label="Nombre"
          value={datosPerfil?.Nombre}
          icon={<UserRound size={18} color={colors.brand} />}
        />
        <InfoRow
          label="Correo"
          value={datosPerfil?.correo}
          icon={<Mail size={18} color={colors.brand} />}
        />
        <InfoRow
          label="Cargo"
          value={getCargoLabel(datosPerfil?.cargo)}
          icon={<BriefcaseBusiness size={18} color={colors.brand} />}
        />
        <View style={styles.logoutAction}>
          <AppButton
            title="Cerrar sesión"
            icon={<LogOut size={20} color={colors.danger} />}
            variant="danger"
            onPress={handleLogout}
          />
        </View>
      </Card>

      <AppButton
        title="Ver credencial digital"
        icon={<CreditCard size={20} color={colors.brand} />}
        variant="secondary"
      />

      <Card style={styles.documentsCard}>
        <Text style={styles.sectionTitle}>Documentos</Text>
        {renderDocumentItems()}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  profileCard: {
    alignItems: "center",
    gap: spacing.md,
  },
  avatarWrap: {
    width: 148,
    height: 148,
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: 136,
    height: 136,
    borderRadius: radius.pill,
  },
  avatarFallback: {
    width: 136,
    height: 136,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoButton: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.74,
  },
  profileName: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: "900",
    textAlign: "center",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  documentsCard: {
    gap: spacing.sm,
  },
  logoutAction: {
    marginTop: spacing.md,
  },
  documentGroup: {
    gap: spacing.sm,
  },
  documentTypeTitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: "900",
    marginTop: spacing.sm,
  },
  documentItem: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
  },
  documentIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSoft,
  },
  documentItemContent: {
    flex: 1,
  },
  documentText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: "800",
  },
  documentDate: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
});
