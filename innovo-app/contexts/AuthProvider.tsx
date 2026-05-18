import React, {
  createContext,
  useEffect,
  useContext,
  useState,
  ReactNode,
} from "react";
import { useCameraPermissions } from "expo-camera";
import { Alert, Platform } from "react-native";
import { loginApi } from "@/api/standar";
import { refreshSessionApi } from "@/api/standar";
import {getUV} from "@/api/trabajador";
import * as SecureStore from "@/utils/secureStorage";
import { router } from "expo-router";
import { io, Socket } from "socket.io-client";
import { validarToken } from "@/api/standar";
import { GlobalProvider } from "@/contexts/GlobalContext";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import NetInfo from "@react-native-community/netinfo";
import DeviceInfo from "react-native-device-info";
import {
  ensureNotificationPermission,
  getExpoPushToken,
} from "@/utils/notifications";
const apiURL = process.env.EXPO_PUBLIC_API_URL;
const DEFAULT_UV_LOCATION = { lat: -33.015, lng: -71.551 };
const WEB_DEVICE_ID_KEY = "innovo-web-device-id";
interface AuthContextProps {
  login: (rut: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  socket: Socket | null;
  isAuthenticated: boolean;
  obtenerUbicacion: () => Promise<{ lat: number; lng: number } | undefined>;
  uvData: { indiceUV_h: number; indiceUV_m: number };
  checkToken: () => Promise<void>;
}
const obtenerUbicacion = async () => {
  if (Platform.OS === "web") {
    return DEFAULT_UV_LOCATION;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    console.warn("Permiso de ubicación denegado");
    return DEFAULT_UV_LOCATION;
  }
  const location = await Location.getCurrentPositionAsync({});
  const ubicacion = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
  };
  return ubicacion;
};
let locationSubscription: Location.LocationSubscription | null = null; // Guardar la suscripción
let isTracking = false; // Control de ejecución única
const trackLocation = async (socket: Socket | null, token: string) => {
  if (!socket || !token || isTracking) return; // Evitar múltiples ejecuciones
  if (Platform.OS === "web") return;

  // 🔹 Si ya hay una suscripción, cancelarla antes de iniciar una nueva
  if (locationSubscription) {
    locationSubscription.remove();
  }

  let lastUbicacion: { lat: number; lng: number } | null = null; // Última ubicación conocida

  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000, // Se ejecuta cada 5 segundos
      distanceInterval: 10, // Se ejecuta si el usuario se mueve más de 10 metros
    },
    async (location) => {
      const ubicacion = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      // 🔹 Verificar si la ubicación realmente cambió antes de enviarla
      if (
        lastUbicacion &&
        ubicacion.lat === lastUbicacion.lat &&
        ubicacion.lng === lastUbicacion.lng
      ) {
        return;
      }

      lastUbicacion = ubicacion; // Actualizar última ubicación conocida
      // 🔹 Enviar solo si hay cambios
      socket.emit("actualizarUbicacion", { token, ubicacion });
    }
  );
};
const AuthContext = createContext<AuthContextProps | undefined>(undefined);
const getDeviceId = async () => {
  if (Platform.OS !== "web") {
    return DeviceInfo.getUniqueId();
  }

  const existingId = await SecureStore.getItemAsync(WEB_DEVICE_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const generatedId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `web-${crypto.randomUUID()}`
      : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await SecureStore.setItemAsync(WEB_DEVICE_ID_KEY, generatedId);
  return generatedId;
};
export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uvData, setUvData] = useState({ indiceUV_h: 0, indiceUV_m: 0 });
  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    console.log("🔆 Iniciando la aplicación...");
    const fetchUVData = async () => {
      try {
        const ubicacion = (await obtenerUbicacion()) ?? DEFAULT_UV_LOCATION;
        const uvData = await getUV(ubicacion);
        if (!Array.isArray(uvData)) {
          console.warn("Datos UV no disponibles para la ubicación:", ubicacion);
          return;
        }
        setUvData({ indiceUV_h: uvData[0], indiceUV_m: uvData[1] });
      } catch (error) {
        console.warn("No se pudieron cargar los datos UV:", error);
      }
    };
    if (!isAuthenticated) return;
    fetchUVData();
  }, [isAuthenticated]);
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const checkNotificationPermissions = async () => {
      const hasPermission = await ensureNotificationPermission(true);
      if (!hasPermission) {
        console.warn("Permisos de notificaciones denegados");
      }
    };
    checkNotificationPermissions();
  }, []);
  useEffect(() => {
    let cancel = false; // para que, si se desmonta el componente, podamos “cancelar” el bucle
    const checkConnectionLoop = async () => {
      if (cancel) return; // en caso de que se desmonte antes de terminar
      // 1. Chequeamos conexión
      const redStatus = await statusConnection();
      if (redStatus) {
        // 2. Hay conexión: continuar lógica
        checkToken();
      } else {
        // 3. NO hay conexión: mostrar alerta y esperar interacción
        Alert.alert(
          "❌ Sin conexión con el Servidor.",
          "Intente de nuevo mas tarde.",
          [
            {
              text: "OK",
              onPress: () => {
                if (!cancel) {
                  // Esperar 3 seg antes de reintentar
                  setTimeout(() => {
                    checkConnectionLoop();
                  }, 10000);
                }
              },
            },
          ],
          { cancelable: false }
        );
      }
    };

    // Iniciar el ciclo
    checkConnectionLoop();

    return () => {
      cancel = true; // si el componente se desmonta, detiene el bucle
    };
  }, []);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!socket || !isAuthenticated) return;
      // Solo nos interesa manejar el socket cuando el usuario está logueado
      if (state.isConnected) {
        console.log("📶 Se recuperó la conexión a Internet");
        if (!socket.connected) {
          socket.connect();
        }
      } else {
        console.log("❌ Se perdió la conexión a Internet");
      }
    });
    return () => {
      unsubscribe();
    };
  }, [socket, isAuthenticated]);
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        router.push("/(lector)/modalNotificaciones");
      });

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);
  
  if (Platform.OS !== "web") {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
  const connectSocket = (token: string) => {
    if (socket && isAuthenticated) {
      console.warn(
        "⚠️ WebSocket ya está conectado. No se abrirá una nueva conexión."
      );
      return;
    }
    console.log("Socket.IO auth token disponible:", {
      hasToken: Boolean(token),
      length: token?.length ?? 0,
    });
    const socketInstance = io("https://api.innovoservicios.cl", {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    });


    socketInstance.on("connect", async () => {
      console.log("🔗 Conectado a Socket.IO");
      const ubicacion = await obtenerUbicacion().then((ubicacion) => {
        return ubicacion;
      });

      socketInstance.emit("registrarTrabajador", { token, ubicacion }); // Enviamos el token
      await trackLocation(socketInstance, token); // Seguimiento con token
    });
    socketInstance.on("disconnect", (reason) => {
      console.warn("Socket.IO desconectado:", reason);
    });
    socketInstance.on("reconnect_attempt", () => {
      console.log("Intentando reconectar...");
    });
    socketInstance.on("connect_error", (error) => {
      console.warn("Error al conectar Socket.IO:", error.message);
    });
    socketInstance.on("message", (data) => {
      console.log("Mensaje recibido del servidor:", data);
    });
    // Escuchar evento de notificación
    setSocket(socketInstance);
    return () => {
      socketInstance.disconnect(); // Desconectar al desmontar
    };
  };
  const statusConnection = async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      return false;
    }
    try {
      if (!apiURL) {
        throw new Error("API URL is not defined");
      }
      const response = await fetch(apiURL);
      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.warn("Error al comprobar disponibilidad del servidor:", error);
      return false;
    }
  };
  const login = async (rut: string, password: string) => {
    const redStatus = await statusConnection();
    if (!redStatus) {
      console.warn("❌ Sin conexión con el servidor.");
      alert("No hay conexión a Internet.");
      return;
    }
    try {
      const hasPermission = Platform.OS === "web" ? false : await ensureNotificationPermission(true);
      const pushToken = hasPermission ? await getExpoPushToken() : null;
      const deviceID = await getDeviceId(); // Obtener el ID único del dispositivo
      if (
        !deviceID ||
        deviceID.trim() === "" ||
        (Platform.OS !== "web" && (!pushToken || pushToken.trim() === ""))
      ) {
        console.error("Falta deviceID o pushToken, o están vacíos");
        alert("❌ Error al obtener información del dispositivo.");
        return;
      }
      const session = await loginApi(rut, password, deviceID, pushToken); // Enviar el pushToken al backend
      if (session?.token) {
        await SecureStore.setItemAsync("token", session.token);
        if (session.refreshToken) {
          await SecureStore.setItemAsync("refreshToken", session.refreshToken);
        }
        setIsAuthenticated(true);
        if (!socket) connectSocket(session.token);
        router.dismissTo("/(lector)/home");
      } else {
        alert("❌ Usuario o contraseña incorrectos.");
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
    }
  };
  const logout = async () => {
    try {
      if (locationSubscription) {
        locationSubscription.remove();
        locationSubscription = null;
      }
      isTracking = false;

      socket?.disconnect();
      setSocket(null);
      await SecureStore.deleteItemAsync("token");
      await SecureStore.deleteItemAsync("refreshToken");
      setIsAuthenticated(false);
      router.replace("/_index");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      Alert.alert("Error", "No se pudo cerrar la sesión.");
    }
  };
  const checkToken = async () => {
    const redStatus = await statusConnection();
    if (!redStatus) return;
    let token = await validarToken();
    if (!token) {
      const refreshedSession = await refreshSessionApi();
      if (refreshedSession && refreshedSession.token) {
        token = refreshedSession.token;
        await SecureStore.setItemAsync("token", refreshedSession.token);
        if (refreshedSession.refreshToken) {
          await SecureStore.setItemAsync("refreshToken", refreshedSession.refreshToken);
        }
      }
    }
    if (token) {
      setIsAuthenticated(true);
      if (!socket) connectSocket(token);
      const hasPermission = Platform.OS === "web" ? false : await ensureNotificationPermission(true);
      const pushToken = hasPermission ? await getExpoPushToken() : null;
      if (pushToken) {
        await fetch(`${apiURL}trabajador/updatePushToken`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token: token, tokenPush: pushToken }),
        });
      }
      router.dismissTo("/(lector)/home");
    } else {
      setIsAuthenticated(false);
      router.replace("/_index");
    }
  };
  
  /*
   const handleNotification = async (data: any) => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const { status: newStatus } =
        await Notifications.requestPermissionsAsync();
      if (newStatus !== "granted") {
        console.warn("Permisos de notificaciones denegados");
        return;
      }
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: data.title || "Notificación",
        body: data.body || "Tienes una nueva notificación",
        data: data.data || {},
      },
      trigger: null,
    });
  };*/
  return (
    <AuthContext.Provider
      value={{
        login,
        logout,
        socket,
        isAuthenticated,
        obtenerUbicacion,
        uvData,
        checkToken,
      }}
    >
      <StatusBar hidden />
      <GlobalProvider socket={socket} enabled={isAuthenticated}>
        {children}
      </GlobalProvider>
    </AuthContext.Provider>
  );
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};
