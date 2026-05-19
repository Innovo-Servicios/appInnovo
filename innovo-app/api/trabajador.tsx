import * as SecureStore from "@/utils/secureStorage";
import {
  Novedad,
  NotificacionesPageRequest,
  NotificacionesPageResponse,
} from "@/types/interfaces";
import { appendFormDataFile } from "@/utils/formDataFile";
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

const getMultipartAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const getJsonAuthHeaders = (token: string) => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

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
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const token = datos.token;
    const response = await fetch(`${apiUrl}asignacion/asignacionMes`, {
      method: "POST",
      headers: getJsonAuthHeaders(token),
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
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}middleware/obtenerATE`, {
      method: "POST",
      headers: getJsonAuthHeaders(datos.token),
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
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}tipoNovedad/obtenerTipoNovedad`, {
      method: "POST",
      headers: getJsonAuthHeaders(datos.token),
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
    if (!datos?.token) {
      throw new Error("Token de autenticación no válido");
    }
    const formData = new FormData();
    formData.append("token", datos.token);
    
    formData.append("TipoNovedadConsulta", novedad.tipoNovedad || "");
    if (novedad.foto) {
      const fotos = Array.isArray(novedad.foto) ? novedad.foto : [novedad.foto];

      for (const [index, uri] of fotos.entries()) {
        await appendFormDataFile(formData, "file", uri, {
          type: "image/jpeg",
          name: fotos.length > 1 ? `upload_${index}.jpg` : "upload.jpg",
        });
      }
    }
    formData.append("idMedidor", novedad.numeroMedidor ? novedad.numeroMedidor.toString() : "");
    formData.append("_id", _id);
    formData.append("Lecturacorrecta", novedad.lectura?.toString() || "");
    formData.append("Comentario", novedad.comentario || "");
    const response = await fetch(`${apiUrl}novedad/crearNovedad`, {
      method: "POST",
      headers: getMultipartAuthHeaders(datos.token),
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
  fotoUri: string | null,
  comentario?: string | null,
  lecturaCorrecta?: number | null
) => {
  if (!id_ate || !fotoUri || !tipo) {
    throw new Error("ID de ATE, tipo o foto no válidos");
  }

  try {
    const datos = await obtenerStore();
    if (!datos || !datos.token) {
      throw new Error("Token de autenticación no válido");
    }

    const formData = new FormData();
    await appendFormDataFile(formData, "file", fotoUri, {
      type: "image/jpeg",
      name: "upload.jpg",
    });
    formData.append("token", datos.token);
    formData.append("id_ate", id_ate);
    formData.append("tipo", tipo);
    if (comentario) formData.append("comentario", comentario);
    formData.append("Lecturacorrecta", lecturaCorrecta === null || lecturaCorrecta === undefined ? "" : lecturaCorrecta.toString());
    // Enviar al backend
    const response = await fetch(`${apiUrl}middleware/repsuestaATE`, {
      method: "POST",
      headers: getMultipartAuthHeaders(datos.token),
      body: formData,
    });
    if (response.ok) {
      return response;
      // Aquí puedes manejar la respuesta exitosa
    }

    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(
      `Error al subir la imagen (${response.status}${errorText ? `: ${errorText}` : ""})`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al enviar ATE";
    console.error("Error al enviar ATE:", message);
    throw new Error(message);
  }
};
export const getNotificaciones = async () => {
  try {
    const datos = await obtenerStore();
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}notificaciones/getNoti`, {
      method: "POST",
      headers: getJsonAuthHeaders(datos.token),
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
export const getNotificacionesPage = async ({
  range,
  cursor = null,
  limit = 20,
}: NotificacionesPageRequest): Promise<NotificacionesPageResponse> => {
  try {
    const datos = await obtenerStore();
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}notificaciones/getNotiPage`, {
      method: "POST",
      headers: getJsonAuthHeaders(datos.token),
      body: JSON.stringify({
        token: datos.token,
        range,
        cursor,
        limit,
      }),
    });
    if (response.ok) {
      return response.json();
    }
    throw new Error(response.statusText);
  } catch (error) {
    console.error("Error al obtener las notificaciones paginadas", error);
    throw error;
  }
};
export const getPerfil = async () => {
  try {
    const datos = await obtenerStore();
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}trabajador/datosApp`, {
      method: "POST",
      headers: getJsonAuthHeaders(datos.token),
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
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(
      `${apiUrl}notificaciones/eliminarNotificacion`,
      {
        method: "POST",
        headers: getJsonAuthHeaders(datos.token),
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
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(
      `${apiUrl}notificacion_vista/registroNotificacion`,
      {
        method: "POST",
        headers: getJsonAuthHeaders(datos.token),
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
export const firmarNotificacion = async (id: string, codigo: string) => {
  try {
    const datos = await obtenerStore();
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}notificaciones/validacion/firmar`, {
      method: "POST",
      headers: {
        ...getJsonAuthHeaders(datos.token),
      },
      body: JSON.stringify({
        token: datos.token,
        idNotificacion: id,
        codigo,
      }),
    });

    if (response.ok) {
      return response.json();
    }

    const message = await response.text();
    throw new Error(message || "No se pudo firmar la notificación");
  } catch (error) {
    console.error("Error al firmar notificación", error);
    throw error;
  }
};
export const aceptarNotificacion = async (id: string) => {
  try {
    const datos = await obtenerStore();
    if (!datos?.token) {
      throw new Error("No se pudieron obtener los datos del SecureStore");
    }
    const response = await fetch(`${apiUrl}notificaciones/validacion/aceptar`, {
      method: "POST",
      headers: {
        ...getJsonAuthHeaders(datos.token),
      },
      body: JSON.stringify({
        token: datos.token,
        idNotificacion: id,
      }),
    });

    if (response.ok) {
      return response.json();
    }

    const message = await response.text();
    throw new Error(message || "No se pudo aceptar la notificación");
  } catch (error) {
    console.error("Error al aceptar notificación", error);
    throw error;
  }
};
export const updatePerfil = async (foto: string) => {
  try {
    const datos = await obtenerStore();
    if (!datos?.token) {
      throw new Error("Token de autenticación no válido");
    }
    const formData = new FormData();
    formData.append("token", datos.token);
    if (foto) {
      await appendFormDataFile(formData, "file", foto, {
        type: "image/jpeg",
        name: "perfil.jpg",
      });
    }
    const response = await fetch(`${apiUrl}trabajador/fotoTrabajador`, {
      method: "POST",
      headers: getMultipartAuthHeaders(datos.token),
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
        ...getJsonAuthHeaders(datos.token),
      },
      body: JSON.stringify({
        lat: ubicacion.lat,
        lng: ubicacion.lng,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    }

    console.warn("No se pudieron obtener los datos de la UV", {
      status: response.status,
      statusText: response.statusText,
    });
    return null;
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
        ...getJsonAuthHeaders(datos.token),
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
