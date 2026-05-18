import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  AlertCircle,
  Bell,
  ChevronLeft,
  FileText,
  Mail,
  MailOpen,
  Trash2,
} from "lucide-react-native";
import { useGlobalContext } from "@/contexts/GlobalContext";
import type { Notificacion, NotificacionesRange } from "@/types/interfaces";
import {
  deleteNotificacion,
  getNotificacionesPage,
  updateStateNotificacion,
} from "@/api/trabajador";
import { AppButton, AppHeader, Badge, Card, EmptyState, IconButton, Screen } from "@/components/ui";
import { colors, fontSizes, radius, spacing } from "@/constants/theme";

const PAGE_LIMIT = 20;

const mergeNotifications = (current: Notificacion[], next: Notificacion[]) => {
  const byId = new Map<string, Notificacion>();

  [...current, ...next].forEach((notification) => {
    byId.set(String(notification.id), notification);
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );
};

export default function NotificacionesModal() {
  const { notificaciones, setNotificaciones } = useGlobalContext();
  const [isInitialLoading, setInitialLoading] = useState(true);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayCursor, setTodayCursor] = useState<string | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [todayHasMore, setTodayHasMore] = useState(true);
  const [olderHasMore, setOlderHasMore] = useState(true);
  const [nextRange, setNextRange] = useState<NotificacionesRange>("today");
  const [hasLoadedToday, setHasLoadedToday] = useState(false);

  const loadPage = useCallback(
    async (range: NotificacionesRange, mode: "initial" | "more" = "more") => {
      const cursor = range === "today" ? todayCursor : olderCursor;

      if (mode === "initial") {
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const page = await getNotificacionesPage({
          range,
          cursor: mode === "initial" ? null : cursor,
          limit: PAGE_LIMIT,
        });

        setNotificaciones((current) => mergeNotifications(current, page.items || []));

        if (range === "today") {
          setHasLoadedToday(true);
          setTodayCursor(page.nextCursor);
          setTodayHasMore(page.hasMore);
          if (!page.hasMore) {
            setNextRange("older");
          }
        } else {
          setOlderCursor(page.nextCursor);
          setOlderHasMore(page.hasMore);
          setNextRange("older");
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las notificaciones."
        );
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [olderCursor, setNotificaciones, todayCursor]
  );

  useEffect(() => {
    loadPage("today", "initial");
  }, []);

  const getIconForType = (tipo: string) => {
    switch (tipo) {
      case "alert":
        return <AlertCircle size={22} color={colors.warning} />;
      case "msg":
        return <Mail size={22} color={colors.brand} />;
      case "document":
        return <FileText size={22} color={colors.info} />;
      default:
        return <Bell size={22} color={colors.brand} />;
    }
  };

  const getValidationLabel = (item: Notificacion) => {
    if (!item.validacion?.required) {
      return null;
    }

    switch (item.validacion.estado) {
      case "aceptado":
        return "Aceptado";
      case "firmado":
        return "Firmado";
      case "vencido":
        return "Vencido";
      case "bloqueado":
        return "Bloqueado";
      default:
        return "Firma pendiente";
    }
  };

  const getValidationStyle = (item: Notificacion) => {
    if (!item.validacion?.required) {
      return styles.validationNeutral;
    }

    switch (item.validacion.estado) {
      case "aceptado":
        return styles.validationSuccess;
      case "firmado":
        return styles.validationWarning;
      case "vencido":
      case "bloqueado":
        return styles.validationDanger;
      default:
        return styles.validationNeutral;
    }
  };

  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: Notificacion[] } = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notificaciones.forEach((notificacion: Notificacion) => {
      const notifDate = new Date(notificacion.fecha);
      let groupKey;

      if (notifDate.toDateString() === today.toDateString()) {
        groupKey = "Hoy";
      } else if (notifDate.toDateString() === yesterday.toDateString()) {
        groupKey = "Ayer";
      } else {
        groupKey = notifDate.toLocaleDateString("es-CL", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notificacion);
    });

    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "Hoy") return -1;
      if (b[0] === "Hoy") return 1;
      if (a[0] === "Ayer") return -1;
      if (b[0] === "Ayer") return 1;
      return new Date(b[1][0].fecha).getTime() - new Date(a[1][0].fecha).getTime();
    });
  }, [notificaciones]);

  const handleNotificationPress = async (notification: Notificacion) => {
    let selectedNotification = notification;

    if (!notification.estado) {
      try {
        const res = await updateStateNotificacion(notification.id);
        if (!res.ok) {
          Alert.alert("Error", "No se pudo registrar la lectura de la notificación.");
          return;
        }

        selectedNotification = { ...notification, estado: true };
        setNotificaciones((current) =>
          current.map((item) =>
            item.id === notification.id ? selectedNotification : item
          )
        );
      } catch {
        Alert.alert("Error", "No se pudo registrar la lectura de la notificación.");
        return;
      }
    }

    router.push({
      pathname: "/(lector)/modalNotificacion",
      params: { notification: JSON.stringify(selectedNotification) },
    });
  };

  const handleDeleteNotification = (notification: Notificacion) => {
    if (!notification.estado) {
      Alert.alert(
        "Lectura requerida",
        "Debes abrir y leer la notificación antes de poder eliminarla."
      );
      return;
    }

    Alert.alert(
      "Eliminar notificación",
      "La notificación se ocultará de tu bandeja, pero seguirá disponible para auditoría.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          onPress: async () => {
            const res = await deleteNotificacion(notification.id);
            if (res.ok) {
              setNotificaciones((current) =>
                current.filter((notificacion) => notificacion.id !== notification.id)
              );
            } else {
              const message = res.status === 409
                ? "Debes leer la notificación antes de eliminarla."
                : "No se pudo eliminar la notificación.";
              Alert.alert("Error", message);
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  const renderNotificationItem = (item: Notificacion) => (
    <Pressable
      style={({ pressed }) => [styles.notificationItem, pressed && styles.pressed]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>{getIconForType(item.tipo)}</View>
      <View style={styles.notificationContent}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.notificationTitle}>
            {item.titulo || "Notificación"}
          </Text>
          {item.estado ? (
            <MailOpen size={18} color={colors.success} />
          ) : (
            <Mail size={18} color={colors.warning} />
          )}
        </View>
        <Text style={styles.notificationDescription} numberOfLines={2} ellipsizeMode="tail">
          {item.mensaje}
        </Text>
        {getValidationLabel(item) ? (
          <Text style={[styles.validationBadge, getValidationStyle(item)]}>
            {getValidationLabel(item)}
          </Text>
        ) : null}
        <Text style={styles.notificationTime}>
          {new Date(item.fecha).toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <IconButton
        label={item.estado ? "Eliminar notificación" : "Debe leer antes de eliminar"}
        variant={item.estado ? "danger" : "soft"}
        size={38}
        icon={<Trash2 size={18} color={item.estado ? colors.danger : colors.textSubtle} />}
        onPress={() => handleDeleteNotification(item)}
      />
    </Pressable>
  );

  const canLoadMore = nextRange === "today" ? todayHasMore : olderHasMore;
  const loadMoreLabel = nextRange === "today" ? "Cargar más de hoy" : "Cargar anteriores";

  const renderFooter = () => {
    if (isInitialLoading) {
      return null;
    }

    if (!canLoadMore) {
      return (
        <Text style={styles.endText}>
          No hay más notificaciones para cargar.
        </Text>
      );
    }

    return (
      <AppButton
        title={loadMoreLabel}
        variant="secondary"
        loading={isLoadingMore}
        onPress={() => loadPage(nextRange)}
      />
    );
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.topRow}>
        <IconButton
          label="Volver"
          variant="plain"
          size={44}
          icon={<ChevronLeft size={24} color={colors.text} />}
          onPress={() => router.back()}
        />
      </View>

      <AppHeader
        eyebrow="Bandeja"
        title="Notificaciones"
        subtitle="Primero se cargan las de hoy; las antiguas se solicitan bajo demanda."
        icon={<Bell size={24} color={colors.brand} />}
        action={<Badge label={`${notificaciones.length}`} tone={notificaciones.length > 0 ? "brand" : "neutral"} />}
      />

      {error ? (
        <Card compact>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton
            title="Reintentar"
            variant="secondary"
            onPress={() => loadPage(nextRange, nextRange === "today" ? "initial" : "more")}
          />
        </Card>
      ) : null}

      {isInitialLoading ? (
        <Card>
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Cargando notificaciones de hoy...</Text>
          </View>
        </Card>
      ) : groupedNotifications.length > 0 ? (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={groupedNotifications}
          keyExtractor={(item) => item[0]}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={renderFooter}
          renderItem={({ item: [title, notifications] }) => (
            <View style={styles.group}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <View style={styles.groupItems}>
                {notifications.map((notification) => (
                  <React.Fragment key={notification.id}>
                    {renderNotificationItem(notification)}
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}
        />
      ) : (
        <Card>
          <EmptyState
            icon={<Bell size={24} color={colors.textMuted} />}
            title={hasLoadedToday ? "Sin notificaciones de hoy" : "Sin notificaciones"}
            description="Puedes cargar notificaciones anteriores cuando lo necesites."
          />
          {renderFooter()}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  topRow: {
    alignItems: "flex-start",
  },
  listContent: {
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: "900",
    marginLeft: spacing.xs,
  },
  groupItems: {
    gap: spacing.sm,
  },
  notificationItem: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.74,
  },
  notificationIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationContent: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  notificationTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: "900",
  },
  notificationDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 19,
  },
  validationBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: fontSizes.xs,
    fontWeight: "900",
  },
  validationNeutral: {
    backgroundColor: colors.brandSoft,
    color: colors.brand,
  },
  validationSuccess: {
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  validationWarning: {
    backgroundColor: colors.warningSoft,
    color: colors.warning,
  },
  validationDanger: {
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
  notificationTime: {
    color: colors.textSubtle,
    fontSize: fontSizes.xs,
    fontWeight: "700",
  },
  loadingState: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: "800",
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  endText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});
