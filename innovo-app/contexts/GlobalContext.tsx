import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import {
  getTiposNovedad,
  getAsignaciones,
  getDataOffline,
  getATE,
} from "@/api/trabajador";
import {
  Novedad,
  Ate,
  TipoNovedad,
  Notificacion,
  Asignacion,
  DataOffline,
  GlobalContextProps,
} from "@/types/interfaces";
import * as Notifications from "expo-notifications";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { Socket } from "socket.io-client";

dayjs.extend(utc);
dayjs.extend(timezone);

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);
const getStringValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
};

const normalizeIncomingNotification = (
  payload: Record<string, unknown>,
  fallback?: { title?: string | null; body?: string | null }
): Notificacion | null => {
  const id =
    getStringValue(payload.id) ||
    getStringValue(payload._id) ||
    getStringValue(payload.idNotificacion);

  if (!id) {
    return null;
  }

  return {
    id,
    tipo: getStringValue(payload.tipo) || "msg",
    titulo: getStringValue(payload.titulo) || fallback?.title || "Notificación",
    mensaje: getStringValue(payload.mensaje) || fallback?.body || "",
    contenido: getStringValue(payload.contenido) || getStringValue(payload.contenidos) || "",
    fecha: getStringValue(payload.fecha) || new Date().toISOString(),
    url: getStringValue(payload.url),
    estado: payload.estado === true || payload.estado === "true",
  };
};

const mergeIncomingNotification = (
  current: Notificacion[],
  incoming: Notificacion
) => {
  const existing = current.find((notification) => notification.id === incoming.id);
  const mergedItem = existing
    ? { ...existing, ...incoming, estado: existing.estado || incoming.estado }
    : incoming;
  const next = existing
    ? current.map((notification) =>
        notification.id === incoming.id ? mergedItem : notification
      )
    : [mergedItem, ...current];

  return next.sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );
};

export const GlobalProvider: React.FC<{ children: ReactNode; socket?: Socket | null }> = ({
  children,
  socket = null,
}) => {
  const [offLine, setOffLine] = useState<DataOffline[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [markedDates, setMarkedDates] = useState({});
  const [calendarSelected, setCalendarSelected] = useState<Asignacion | undefined>(undefined);
  const [dataAte, setDataAte] = useState<Ate[]>([]);
  const [tipoNovedad, setTipoNovedad] = useState<TipoNovedad[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [newAte, setNewAte] = useState<Ate>({
    id_ate: null,
    direccion: null,
    sector: null,
    tipo: null,
    comentario: null,
    lat: null,
    lng: null,
    numeroMedidor: null,
    fotoUri: null
  });
  const [newNovedad, setNewNovedad] = useState<Novedad>({
    direccion: null,
    numeroMedidor: null,
    comentario: null,
    lectura: null,
    foto: null,
    tipoNovedad: null,
  });
  const obtenerDatosOffline = async () => {
    try {
      const datos = await getDataOffline();
      setOffLine(datos);
    } catch (error) {
      console.warn("Error al obtener datos offline:", error);
      setOffLine([]);
    }
  };
  const updateNovedad = (key: keyof Novedad, value: Novedad[keyof Novedad]) => {
    setNewNovedad((prevNovedad) => ({
      ...prevNovedad,
      [key]: value,
    }));
  };
  const clearAte = () => {
    setNewAte({
      id_ate: null,
      direccion: null,
      sector: null,
      tipo: null,
      comentario: null,
      lat: null,
      lng: null,
      numeroMedidor: null,
      fotoUri: null
    });
  };
  useEffect(() => {
    if (tipoNovedad.length === 0) {
      getTiposNovedad().then((tipos) => {
        setTipoNovedad(tipos);
        setTipoNovedad(
          tipos.map((tipo: any) => ({
            _id: tipo._id,
            value: tipo.value,
          }))
        );
      });
    }
  }, [tipoNovedad]);
  useEffect(() => {
    (async () => {
      try {
        const asignaciones = await getAsignaciones();
        setAsignaciones(asignaciones);
        //functionFilter(asignaciones, selected);
        const marked = asignaciones.reduce(
          (
            acc: {
              [x: string]: {
                marked: boolean;
                dotColor: string;
                selected: boolean;
                selectedColor: string;
              };
            },
            curr: { tipo: string; fecha_asignacion: string | number }
          ) => {
            const bg = curr.tipo === "lectura" ? "#ff5757" : "#0057b7";
            const dot = curr.tipo === "lectura" ? "white" : "white";
            acc[curr.fecha_asignacion] = {
              marked: true,
              dotColor: dot,
              selected: true,
              selectedColor: bg,
            };
            return acc;
          },
          {}
        );
        setMarkedDates(marked);
      } catch (error) {
        console.warn("Error al obtener las asignaciones:", error);
        setAsignaciones([]);
        setMarkedDates({});
      }
    })();
  }, []);
  useEffect(() => {
    obtenerDatosOffline();
  }, []);

  useEffect(() => {
    // Obtener datos de la API
    const fecha = dayjs().toString();
    const fetchRuta = async () => {
      try {
        const data = await getATE(fecha);
        setDataAte(data);
      } catch (error) {
        console.warn("Error al obtener la ruta:", error);
        setDataAte([]);
      }
    };
    fetchRuta();
  }, []);
  useEffect(() => {
      const notificationListener =
        Notifications.addNotificationReceivedListener((notification) => {
          const nuevaNotificacion = normalizeIncomingNotification(
            notification.request.content.data as Record<string, unknown>,
            {
              title: notification.request.content.title,
              body: notification.request.content.body,
            }
          );

          if (!nuevaNotificacion) {
            return;
          }

          setNotificaciones((prevNotificaciones) =>
            mergeIncomingNotification(prevNotificaciones, nuevaNotificacion)
          );
        });
  
      return () => {
        Notifications.removeNotificationSubscription(notificationListener);
      };
    }, []);
  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleLiveNotification = (payload: Record<string, unknown>) => {
      const nuevaNotificacion = normalizeIncomingNotification(payload);
      if (!nuevaNotificacion) {
        return;
      }

      setNotificaciones((prevNotificaciones) =>
        mergeIncomingNotification(prevNotificaciones, nuevaNotificacion)
      );
    };

    socket.on("nuevaNotificacion", handleLiveNotification);

    return () => {
      socket.off("nuevaNotificacion", handleLiveNotification);
    };
  }, [socket]);
  return (
    <GlobalContext.Provider
      value={{
        newNovedad,
        setNewNovedad,
        updateNovedad,
        newAte,
        setNewAte,
        tipoNovedad,
        clearAte,
        notificaciones,
        setNotificaciones,
        asignaciones,
        markedDates,
        calendarSelected,
        setCalendarSelected,
        offLine,
        setOffLine,
        dataAte,
        setDataAte,
        photoUri, 
        setPhotoUri,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobalContext debe usarse dentro de un GlobalProvider");
  }
  return context;
};
