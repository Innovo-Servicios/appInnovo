import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getLegacyAssetPath = (rawPath: string) => {
  const legacyMatch = rawPath.match(
    /\/IMG_(ATES|NOVEDADES|PERFILES|VERIFICACIONES)\/([^?#]+)/i
  );
  if (!legacyMatch) return null;

  const typeMap: Record<string, string> = {
    ATES: "ate",
    NOVEDADES: "novedades",
    PERFILES: "perfiles",
    VERIFICACIONES: "verificaciones",
  };

  const type = typeMap[legacyMatch[1].toUpperCase()];
  const fileName = legacyMatch[2].split(/[\\/]/).filter(Boolean).pop();
  return type && fileName ? `/assets/${type}/${encodeURIComponent(fileName)}` : null;
};

const getSafeFileName = (fileUrl: string, fallbackName: string) => {
  try {
    const parsedUrl = new URL(fileUrl);
    const pathName = decodeURIComponent(parsedUrl.pathname);
    const fileName = pathName.split("/").filter(Boolean).pop();
    return (fileName || fallbackName).replace(/[^\w.\-]+/g, "_");
  } catch {
    return fallbackName.replace(/[^\w.\-]+/g, "_");
  }
};

export const buildApiFileUrl = (filePath?: string | null) => {
  const rawPath = String(filePath || "").trim();
  if (!rawPath || !apiUrl) return "";

  const legacyAssetPath = getLegacyAssetPath(rawPath);
  const normalizedPath = legacyAssetPath || rawPath;

  try {
    const apiBase = new URL(trimTrailingSlash(apiUrl));
    const parsedUrl = new URL(normalizedPath, `${apiBase.origin}/`);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) return "";
    if (parsedUrl.origin !== apiBase.origin) return "";

    return parsedUrl.toString();
  } catch {
    return "";
  }
};

export const getAuthenticatedImageSource = (
  filePath?: string | null,
  accessToken?: string | null
) => {
  const uri = buildApiFileUrl(filePath);
  if (!uri) return undefined;

  return {
    uri,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  };
};

export const openAuthenticatedFile = async (
  filePath: string,
  accessToken: string,
  fallbackName = "documento"
) => {
  const uri = buildApiFileUrl(filePath);
  if (!uri) {
    throw new Error("Ruta de archivo inválida");
  }

  const downloadRoot = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!downloadRoot) {
    throw new Error("No hay almacenamiento local disponible");
  }

  const fileName = `${Date.now()}-${getSafeFileName(uri, fallbackName)}`;
  const destination = `${downloadRoot}${fileName}`;
  const result = await FileSystem.downloadAsync(uri, destination, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error("No se pudo descargar el archivo");
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("No hay una aplicación disponible para abrir el archivo");
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: result.mimeType || undefined,
    dialogTitle: fallbackName,
  });
};
