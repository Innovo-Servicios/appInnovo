import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import {
  getTiposNovedad,
  getNotificaciones,
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

dayjs.extend(utc);
dayjs.extend(timezone);

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);
export const GlobalProvider: React.FC<{ children: ReactNode }> = ({
  children,
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
    if (notificaciones.length === 0) {
      getNotificaciones().then((notificaciones) => {
        setNotificaciones(notificaciones);
      });
    }
  }, [notificaciones]);
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
            const nuevaNotificacion: Notificacion = {
            id: notification.request.content.data.idNotificacion,
            tipo: notification.request.content.data.tipo,
            titulo: notification.request.content.title,
            mensaje: notification.request.content.body,
            contenido: notification.request.content.data.contenidos,
            fecha: notification.request.content.data.fecha,
            url: notification.request.content.data.url,
            estado: false,
            };
          setNotificaciones((prevNotificaciones) => [
            nuevaNotificacion,
            ...prevNotificaciones,
          ]);
        });
  
      return () => {
        Notifications.removeNotificationSubscription(notificationListener);
      };
    }, []);
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
