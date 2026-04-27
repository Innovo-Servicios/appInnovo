import * as SecureStore from "expo-secure-store";
import { Novedad } from "@/types/interfaces";
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
export async function obtenerStore() {
  try {
    const datos = {
      token: await SecureStore.getItemAsync("token"),
    };
    return datos;
  } catch (error) {
    console.error("Error al obtener datos de SecureStore:", error);
    return null;
  }
}
export const getAsignaciones = async () => {
  try {
    const datos = await obtenerStore();
    if (!datos) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const token = datos.token;
    const response = await fetch(`${apiUrl}asignacion/asignacionMes`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: token,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error("a");
    }
  } catch (error) {
    console.error("Error al obtener las asignaciones:", error);
    throw new Error("Error al obtener las asignaciones");
  }
};
export const getATE = async (fecha: string) => {
  try {
    const datos = await obtenerStore();
    if (!datos) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}middleware/obtenerATE`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: datos.token,
        fecha: fecha,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error(response.statusText);
    }
  } catch (error) {
    console.error("Error al obtener las asignacionesAte:", error);
    throw new Error("Error al obtener las asignacionesAte");
  }
};
export const getTiposNovedad = async () => {
  try {
    const datos = await obtenerStore();
    if (!datos) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}tipoNovedad/obtenerTipoNovedad`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: datos.token,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error("Error al obtener los tipos de novedades");
    }
  } catch (error) {
    console.error("Error al obtener tipos de novedades", error);
    throw new Error("Error al obtener los tipos de novedades");
  }
};
export const sendNovedad = async (novedad: Novedad, _id:string) => {
  try {
    const datos = await obtenerStore();
    if (!datos) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const formData = new FormData();
    formData.append("token", datos.token || "");
    
    formData.append("TipoNovedadConsulta", novedad.tipoNovedad || "");
    if (novedad.foto) {
      if (Array.isArray(novedad.foto)) {
        novedad.foto.forEach((uri, index) => {
          formData.append("file", {
            uri: uri,
            type: "image/jpeg", // Ajusta el tipo MIME si fuese necesario
            name: `upload_${index}.jpg`,
          } as any);
        });
      } else {
        // En caso de que 'foto' sea una única URI, lo enviamos con otro nombre de clave
        formData.append("file", {
          uri: typeof novedad.foto === "string" ? (novedad.foto as string).replace("file://", "") : "", // Ajusta la URI si fuese necesario
          type: "image/jpeg",
          name: "upload.jpg",
        } as any);
      }
    }
    formData.append("idMedidor", novedad.numeroMedidor ? novedad.numeroMedidor.toString() : "");
    formData.append("_id", _id);
    formData.append("Lecturacorrecta", novedad.lectura?.toString() || "");
    formData.append("Comentario", novedad.comentario || "");
    const response = await fetch(`${apiUrl}novedad/crearNovedad`, {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      return await response.json();
    } else { 
      throw new Error("Error al enviar la novedad");
    }
  } catch (error) {
    console.error("Error al enviar la novedad:", error);
    throw new Error("Error al enviar la novedad");
  }
};
export const sendAte = async (
  id_ate: string | null,
  tipo: string | null,
  fotoUri: string | null
) => {
  if (!id_ate || !fotoUri || !tipo) {
    throw new Error("ID de ATE, tipo o foto no válidos");
  }

  try {
    const datos = await obtenerStore();
    if (!datos || !datos.token) {
      throw new Error("Token de autenticación no válido");
    }

    // Crear FormData
    const formData = new FormData();
    formData.append("file", {
      uri: fotoUri,
      type: "image/jpeg",
      name: "upload.jpg",
    } as any);
    formData.append("token", datos.token);
    formData.append("id_ate", id_ate);
    formData.append("tipo", tipo);
    // Enviar al backend
    const response = await fetch(`${apiUrl}middleware/repsuestaATE`, {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      return response;
      // Aquí puedes manejar la respuesta exitosa
    } else {
      console.error("Error al subir la imagen");
      // Aquí puedes manejar el error
    }
  } catch (error) {
    console.error("Error al enviar ATE:", (error as any).message);
    throw new Error("Error al enviar ATE");
  }
};
export const getNotificaciones = async () => {
  try {
    const datos = await obtenerStore();
    if (!datos) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}notificaciones/getNoti`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: datos.token,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error(response.statusText);
    }
  } catch (error) {
    console.error("Error al obtener las notificaciones", error);
  }
};
export const getPerfil = async () => {
  try {
    const datos = await obtenerStore();
    if (!datos) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}trabajador/datosApp`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: datos.token,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error("Error al obtener los datos de perfil");
    }
  } catch (error) {
    console.error("Error al obtener los datos de perfil:", error);
    throw new Error("Error al obtener los datos de perfil");
  }
};
export const deleteNotificacion = async (id: string) => {
  try {
    const datos = await obtenerStore();
    if (!datos) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(
      `${apiUrl}notificaciones/eliminarNotificacion`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: datos.token,
          id: id,
        }),
      }
    );
    return response;
  } catch (error) {
    console.error("Error al eliminar notificaciones", error);
    throw new Error("Error al eliminar las notificaciones");
  }
};
export const updateStateNotificacion = async (id: string) => {
  try {
    const datos = await obtenerStore();
    if (!datos) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(
      `${apiUrl}notificacion_vista/registroNotificacion`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: datos.token,
          idNotificacion: id,
        }),
      }
    );
    return response;
  } catch (error) {
    console.error("Error al registrar", error);
    throw new Error("Error al registrar la notificación");
  }
};
export const updatePerfil = async (foto: string) => {
  try {
    const datos = await obtenerStore();
    if (!datos) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const formData = new FormData();
    formData.append("token", datos.token || "");
    if (foto) {
      formData.append("file", {
        uri: foto,
        type: "image/jpeg",
        name: "perfil.jpg",
      } as any);
    }
    const response = await fetch(`${apiUrl}trabajador/fotoTrabajador`, {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      return true;
    } else {
      throw new Error("Error al actualizar la foto de perfil");
    }
  } catch (error) {
    alert("Error al actualizar la foto de perfil");
    throw new Error("Error al actualizar la foto de perfil");
  }
};
export const getUV = async (ubicacion: { lat: number; lng: number }) => {
  try {
    const datos = await obtenerStore();
    if (!datos?.token) {
      console.warn("No hay token disponible para obtener los datos de la UV");
      return null;
    }
    const response = await fetch(`${apiUrl}trabajador/obtenerRegionChile`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${datos.token}`,
      },
      body: JSON.stringify({
        lat: ubicacion.lat,
        lng: ubicacion.lng,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error("Error al obtener los datos de la UV");
    }
  } catch (error) {
    console.warn("Error al obtener los datos de la UV", error);
    return null;
  }
};
export const getDataOffline = async () => {
  try {
    const datos = await obtenerStore();
    if (!datos?.token) {
      console.warn("No hay token disponible para obtener datos offline");
      return [];
    }
    const response = await fetch(`${apiUrl}direccion/listadirecciones`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${datos.token}`,
      },
      body: JSON.stringify({
        token: datos.token,
      }),
    });
    
    if (response.status === 204 || response.status === 401 || response.status === 404) {
      return [];
    }

    if (!response.ok) {
      console.warn("No se pudieron obtener datos offline", response.status);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("Error al obtener los datos offline", error);
    return [];
  }
}
