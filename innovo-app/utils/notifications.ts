import { Alert, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import type { Notificacion } from "@/types/interfaces";

export const NOTIFICATION_CHANNEL_ID = "default";

export const ensureAndroidNotificationChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "Notificaciones",
    description: "Alertas operativas de Innovo",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0057B7",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
};

export const ensureNotificationPermission = async (showSettingsAlert = false) => {
  await ensureAndroidNotificationChannel();

  const currentPermission = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermission.status;

  if (finalStatus !== "granted" && currentPermission.canAskAgain) {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus === "granted") {
    return true;
  }

  if (showSettingsAlert) {
    Alert.alert(
      "Notificaciones desactivadas",
      "Para recibir avisos en la bandeja del dispositivo debes permitir las notificaciones de Innovo App.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Abrir ajustes", onPress: () => Linking.openSettings() },
      ]
    );
  }

  return false;
};

export const getExpoPushToken = async () => {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return tokenResponse.data;
};

export const presentLocalNotification = async (notification: Notificacion) => {
  const hasPermission = await ensureNotificationPermission(true);
  if (!hasPermission) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: `notificacion-${notification.id}`,
    content: {
      title: notification.titulo || "Notificación",
      body: notification.mensaje || "Tienes una nueva notificación",
      data: {
        id: notification.id,
        idNotificacion: notification.id,
        tipo: notification.tipo,
        titulo: notification.titulo,
        mensaje: notification.mensaje,
        contenido: notification.contenido,
        contenidos: notification.contenido,
        fecha: notification.fecha,
        url: notification.url,
      },
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: { channelId: NOTIFICATION_CHANNEL_ID },
  });
};
