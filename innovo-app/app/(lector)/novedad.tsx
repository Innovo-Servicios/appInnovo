import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as SecureStore from "@/utils/secureStorage";
import DropDownPicker from "react-native-dropdown-picker";
import * as ImagePicker from "expo-image-picker";
import { useCameraPermissions } from "expo-camera";
import NetInfo from "@react-native-community/netinfo";
import { router } from "expo-router";
import {
  Camera,
  CircleX,
  ClipboardPen,
  ImagePlus,
  RotateCcw,
  Send,
} from "lucide-react-native";
import OmnipotentInput from "@/components/novedad/OmnipotentInput";
import { sendAte, sendNovedad } from "@/api/trabajador";
import { useGlobalContext } from "@/contexts/GlobalContext";
import type { Ate, Novedad as NovedadPayload } from "@/types/interfaces";
import { AppButton, AppHeader, Badge, Card, Field, IconButton, Screen } from "@/components/ui";
import { colors, fontSizes, radius, spacing } from "@/constants/theme";

const MULTI_PHOTO_TYPE = "67ac4d7e13432b2cbf379597";
const ATE_READING_LABEL = "Atención Especial-Lectura";

const onlyStrings = (items: Array<string | null | undefined>) =>
  items.filter((item): item is string => Boolean(item));

const normalizeFormType = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export default function Novedad() {
  const {
    offLine,
    setOffLine,
    newNovedad,
    setNewNovedad,
    newAte,
    tipoNovedad,
    clearAte,
    setDataAte,
    dataAte,
    photoUri,
    setPhotoUri,
  } = useGlobalContext();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [openNovedad, setOpenNovedad] = useState(false);
  const [photoArray, setPhotoArray] = useState<string[]>([]);
  const [itemsTipo, setItemsTipo] = useState(
    tipoNovedad.map((item) => ({ label: item.value, value: item._id }))
  );
  const filteredItems = useMemo(
    () =>
      !newAte.tipo
        ? itemsTipo.filter(
            (item) =>
              item.label !== "Atención Especial-Lectura" &&
              item.label !== "Atención Especial-Reparto"
          )
        : itemsTipo,
    [itemsTipo, newAte.tipo]
  );
  const [valueDireccion, setValueDireccion] = useState<string | null>(
    newAte.direccion || null
  );
  const [valueTipoNovedad, setValueTipoNovedad] = useState<string | null>(
    itemsTipo.find((item) => item.label === newAte.tipo)?.value || null
  );
  const [wasConnected, setWasConnected] = useState<boolean | null>(false);
  const [valueLectura, setValueLectura] = useState<number | null>(null);
  const [sinLectura, setSinLectura] = useState(false);
  const [valueComentario, setValueComentario] = useState<string | null>(null);
  const [valueMedidor, setValueMedidor] = useState(
    newAte.numeroMedidor ? newAte.numeroMedidor.toString() : null
  );

  const isAteMode = Boolean(newAte.tipo);
  const isMultiPhoto = valueTipoNovedad === MULTI_PHOTO_TYPE;
  const selectedLabel =
    filteredItems.find((item) => item.value === valueTipoNovedad)?.label ||
    newAte.tipo ||
    null;
  const isAteReading = isAteMode && normalizeFormType(newAte.tipo || selectedLabel) === normalizeFormType(ATE_READING_LABEL);
  const effectiveLectura = isAteReading && sinLectura ? null : valueLectura;
  const ateLecturaCorrecta = isAteReading ? effectiveLectura : null;
  const isWeb = Platform.OS === "web";

  const handleSinLecturaChange = (checked: boolean) => {
    setSinLectura(checked);
    if (checked) {
      setValueLectura(null);
    }
  };

  const openCamera = async () => {
    if (isWeb) {
      setPhotoUri(null);
      setNewNovedad({
        numeroMedidor: Number(valueMedidor),
        direccion: valueDireccion,
        tipoNovedad: valueTipoNovedad,
        lectura: effectiveLectura,
        comentario: valueComentario,
        foto: onlyStrings([photoUri]),
      });
      router.push("/(lector)/modalCam");
      return;
    }

    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert("Permiso denegado", "Se requieren permisos para acceder a la cámara.");
        return;
      }
    }

    setPhotoUri(null);
    setNewNovedad({
      numeroMedidor: Number(valueMedidor),
      direccion: valueDireccion,
      tipoNovedad: valueTipoNovedad,
      lectura: effectiveLectura,
      comentario: valueComentario,
      foto: onlyStrings([photoUri]),
    });
    router.push("/(lector)/modalCam");
  };

  const handlerSend = async () => {
    if (!valueDireccion || !valueTipoNovedad || !valueComentario) {
      Alert.alert("Campos incompletos", "Completa dirección, tipo y comentario antes de enviar.");
      return;
    }

    const payload: NovedadPayload = {
      direccion: valueDireccion,
      numeroMedidor: Number(valueMedidor),
      tipoNovedad: selectedLabel,
      comentario: valueComentario,
      lectura: effectiveLectura ?? null,
      foto: isMultiPhoto ? photoArray : onlyStrings([photoUri]),
    };
    const netInfo = await NetInfo.fetch();

    if (!netInfo.isConnected && isWeb) {
      Alert.alert("Sin conexión", "La versión web requiere conexión para enviar formularios.");
      return;
    }

    if (isAteMode) {
      if (!photoUri) {
        Alert.alert("Falta fotografía", "Adjunta una fotografía para completar la ATE.");
        return;
      }

      if (netInfo.isConnected) {
        sendAte(
          newAte.id_ate,
          newAte.tipo,
          payload.foto ? payload.foto.join(",") : null,
          valueComentario,
          ateLecturaCorrecta
        )
          .then(() => {
            Alert.alert("Éxito", "ATE enviada correctamente.");
            setDataAte(dataAte.filter((ate) => ate.id_ate !== newAte.id_ate));
            handlerClean();
          })
          .catch((error) => {
            Alert.alert("Error", error.message);
          });
      } else {
        SaveAteOffline(
          newAte.id_ate,
          newAte.tipo,
          payload.foto ? payload.foto.join(",") : null,
          valueComentario,
          ateLecturaCorrecta
        );
      }
      return;
    }

    if (netInfo.isConnected) {
      const matchingData = offLine.find(
        (item) => item.NumeroMedidor.toString() === payload.numeroMedidor?.toString()
      );
      sendNovedad(payload, matchingData?._id || "")
        .then(() => {
          Alert.alert("Éxito", "Novedad enviada correctamente.");
          const filter = offLine.filter((item) => item.NumeroMedidor !== payload.numeroMedidor);
          setOffLine(filter);
          handlerClean();
        })
        .catch((error) => {
          Alert.alert("Error", error.message);
        });
    } else {
      SaveOffline(payload);
    }
  };

  const handlerClean = () => {
    clearAte();
    setValueMedidor(null);
    setValueDireccion(null);
    setValueTipoNovedad(null);
    setValueLectura(null);
    setSinLectura(false);
    setValueComentario(null);
    setPhotoUri(null);
    setPhotoArray([]);
    setNewNovedad({
      direccion: null,
      numeroMedidor: null,
      comentario: null,
      lectura: null,
      foto: null,
      tipoNovedad: null,
    });
  };

  const pickImageAsync = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: !isMultiPhoto,
      allowsMultipleSelection: isMultiPhoto,
      selectionLimit: 2,
      aspect: [4, 4],
      quality: 1,
    });

    if (result.canceled) {
      return;
    }

    if (isMultiPhoto) {
      setPhotoArray(result.assets.map((item) => item.uri));
    } else {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const SaveOffline = async (payload: NovedadPayload) => {
    try {
      const storedNovedades = await SecureStore.getItemAsync("pendingNovedades");
      const novedadesArray = storedNovedades ? JSON.parse(storedNovedades) : [];
      const exists = novedadesArray.some(
        (novedad: NovedadPayload) => novedad.numeroMedidor === payload.numeroMedidor
      );

      if (exists) {
        Alert.alert("Duplicado", "Ya existe una novedad con este número de medidor.");
        handlerClean();
        return;
      }

      novedadesArray.push(payload);
      await SecureStore.setItemAsync("pendingNovedades", JSON.stringify(novedadesArray));
      Alert.alert("Guardada sin conexión", "La novedad quedó pendiente de sincronización.");
      handlerClean();
    } catch (error) {
      console.error("Error guardando la novedad:", error);
    }
  };

  const SaveAteOffline = async (
    idAte: string | null,
    tipo: string | null,
    fotoUri: string | null,
    comentario?: string | null,
    lecturaCorrecta?: number | null
  ) => {
    try {
      const storedAte = await SecureStore.getItemAsync("pendingAte");
      const ateArray = storedAte ? JSON.parse(storedAte) : [];
      const exists = ateArray.some((ate: Ate) => ate.id_ate === idAte);

      if (exists) {
        Alert.alert("Duplicado", "Ya existe una ATE pendiente con este número de medidor.");
        handlerClean();
        return;
      }

      ateArray.push({
        id_ate: idAte,
        tipo,
        fotoUri,
        comentarioTrabajador: comentario ?? null,
        Lecturacorrecta: lecturaCorrecta ?? null,
      });
      await SecureStore.setItemAsync("pendingAte", JSON.stringify(ateArray));
      Alert.alert("Guardada sin conexión", "La ATE quedó pendiente de sincronización.");
      handlerClean();
    } catch (error) {
      console.error("Error guardando la ATE:", error);
    }
  };

  const filterElement = async (numeroMedidor: number) => {
    const filter = offLine.filter((item) => item.NumeroMedidor !== numeroMedidor);
    setOffLine(filter);
  };

  useEffect(() => {
    if (isWeb) {
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (wasConnected === false && state.isConnected) {
        SecureStore.getItemAsync("pendingNovedades").then((novedades) => {
          if (novedades) {
            const novedadesArray = JSON.parse(novedades);
            const novedadesPendientes: NovedadPayload[] = [];

            novedadesArray.forEach(async (novedad: NovedadPayload) => {
              try {
                const matchingData = offLine.find(
                  (item) =>
                    item.NumeroMedidor.toString() === novedad.numeroMedidor?.toString()
                );
                await sendNovedad(novedad, matchingData?._id || "").then(async () => {
                  if (novedad.numeroMedidor !== null) {
                    await filterElement(novedad.numeroMedidor);
                  }
                });
              } catch (error) {
                console.log("Error al enviar la novedad:", error);
                novedadesPendientes.push(novedad);
              }
            });

            if (novedadesPendientes.length > 0) {
              SecureStore.setItemAsync("pendingNovedades", JSON.stringify(novedadesPendientes));
            } else {
              SecureStore.deleteItemAsync("pendingNovedades");
            }
          }
        });

        SecureStore.getItemAsync("pendingAte").then((ate) => {
          if (ate) {
            const ateArray = JSON.parse(ate);
            const atePendientes: Ate[] = [];
            ateArray.forEach(async (ateItem: Ate) => {
              try {
                await sendAte(
                  ateItem.id_ate,
                  ateItem.tipo,
                  ateItem.fotoUri,
                  ateItem.comentarioTrabajador,
                  ateItem.Lecturacorrecta
                );
              } catch (error) {
                console.error("Error al enviar la ATE:", error);
                atePendientes.push(ateItem);
              }
            });

            if (atePendientes.length > 0) {
              SecureStore.setItemAsync("pendingAte", JSON.stringify(atePendientes));
            } else {
              SecureStore.deleteItemAsync("pendingAte");
            }
          }
        });
      }
      setWasConnected(state.isConnected);
    });

    return () => {
      unsubscribe();
    };
  }, [isWeb, wasConnected, offLine]);

  useEffect(() => {
    if (newNovedad) {
      setValueMedidor(newNovedad.numeroMedidor?.toString() || null);
      setValueDireccion(newNovedad.direccion);
      setValueTipoNovedad(
        itemsTipo.find((item) => item.value === newNovedad.tipoNovedad)?.value || null
      );
      setValueLectura(newNovedad.lectura);
      setValueComentario(newNovedad.comentario);
    }
  }, [newNovedad, itemsTipo]);

  useEffect(() => {
    if (newAte.numeroMedidor) {
      setValueMedidor(newAte.numeroMedidor.toString());
      setValueDireccion(newAte.direccion);
      setValueTipoNovedad(itemsTipo.find((item) => item.label === newAte.tipo)?.value || null);
    }
  }, [newAte, itemsTipo]);

  useEffect(() => {
    setSinLectura(false);
  }, [newAte.id_ate, newAte.tipo]);

  useEffect(() => {
    if (!isAteReading) {
      setSinLectura(false);
    }
  }, [isAteReading]);

  useEffect(() => {
    setItemsTipo(tipoNovedad.map((item) => ({ label: item.value, value: item._id })));
  }, [tipoNovedad]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.flex}>
        <Screen scroll contentStyle={styles.content}>
          <AppHeader
            eyebrow={isAteMode ? "Atención especial" : "Formulario"}
            title={isAteMode ? "Responder ATE" : "Registrar novedad"}
            subtitle="Completa los datos del medidor, adjunta evidencia y envía cuando termines."
            icon={<ClipboardPen size={24} color={colors.brand} />}
            action={
              isAteMode ? (
                <IconButton
                  label="Limpiar ATE"
                  variant="danger"
                  icon={<RotateCcw size={20} color={colors.danger} />}
                  onPress={handlerClean}
                />
              ) : null
            }
          />

          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Medidor</Text>
              {isAteMode ? <Badge label="ATE cargada" tone="warning" /> : null}
            </View>

            <Text style={styles.label}>Número de medidor o dirección</Text>
            <OmnipotentInput
              value={valueMedidor ? valueMedidor.toString() : ""}
              onChangeText={(text) => setValueMedidor(text)}
              setDireccion={setValueDireccion}
              editable={!newAte.numeroMedidor}
            />

            <Text style={styles.label}>Dirección</Text>
            <View style={styles.readonlyBox}>
              <Text style={styles.readonlyText} numberOfLines={3}>
                {valueDireccion || "Selecciona un medidor para completar la dirección."}
              </Text>
            </View>
          </Card>

          <Card style={[styles.card, openNovedad && styles.dropdownCard]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Detalle</Text>
              {selectedLabel ? <Badge label={selectedLabel} tone="brand" /> : null}
            </View>

            <Text style={styles.label}>Tipo</Text>
            <DropDownPicker
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownList}
              listMode="SCROLLVIEW"
              placeholder="Seleccione tipo de formulario"
              placeholderStyle={styles.placeholder}
              containerStyle={styles.dropdownContainer}
              labelStyle={styles.dropdownLabel}
              open={openNovedad}
              value={valueTipoNovedad}
              items={filteredItems}
              setOpen={setOpenNovedad}
              setValue={setValueTipoNovedad}
              setItems={setItemsTipo}
              disabled={Boolean(newAte.tipo)}
            />

            {isMultiPhoto ? (
              <>
                <Field
                  label="Lectura Caldera"
                  placeholder="Ingrese lectura"
                  keyboardType="numeric"
                  maxLength={5}
                  onChangeText={setValueComentario}
                  value={valueComentario || ""}
                />
                <Field
                  label="Lectura Corrector"
                  placeholder="Ingrese lectura"
                  keyboardType="numeric"
                  maxLength={5}
                  onChangeText={(text) => setValueLectura(text ? Number(text) : null)}
                  value={valueLectura !== null ? valueLectura.toString() : ""}
                />
              </>
            ) : (
              <>
                <Field
                  label="Comentarios"
                  placeholder="Describe la novedad encontrada"
                  multiline
                  numberOfLines={4}
                  maxLength={240}
                  onChangeText={setValueComentario}
                  value={valueComentario || ""}
                />
                {isAteReading ? (
                  <>
                    <View style={styles.noReadingRow}>
                      <Text style={styles.noReadingText}>Sin Lectura</Text>
                      <Switch
                        value={sinLectura}
                        onValueChange={handleSinLecturaChange}
                        trackColor={{ false: colors.border, true: colors.brand }}
                        thumbColor={colors.white}
                        ios_backgroundColor={colors.border}
                      />
                    </View>
                    <Field
                      label="Lectura correcta"
                      placeholder="Ingrese lectura correcta"
                      keyboardType="numeric"
                      maxLength={5}
                      onChangeText={(text) => setValueLectura(text ? Number(text) : null)}
                      value={valueLectura !== null ? valueLectura.toString() : ""}
                      editable={!sinLectura}
                      style={sinLectura ? styles.noReadingInputDisabled : null}
                    />
                  </>
                ) : null}
              </>
            )}
          </Card>

          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Evidencia</Text>
              <Badge label={isMultiPhoto ? `${photoArray.length}/2 fotos` : photoUri ? "1 foto" : "Sin foto"} tone={photoUri || photoArray.length ? "success" : "neutral"} />
            </View>

            <View style={styles.photoActions}>
              <IconButton
                label="Seleccionar imagen"
                variant="plain"
                size={58}
                icon={<ImagePlus size={28} color={colors.brand} />}
                onPress={pickImageAsync}
              />
              {!isMultiPhoto ? (
                <IconButton
                  label="Abrir cámara"
                  variant="plain"
                  size={58}
                  icon={<Camera size={28} color={colors.brand} />}
                  onPress={openCamera}
                />
              ) : null}
              <View style={styles.fileBox}>
                <Text style={styles.fileTitle}>{isMultiPhoto ? "Archivos seleccionados" : "Fotografía"}</Text>
                {isMultiPhoto ? (
                  <>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {photoArray[0] ? `${photoArray[0].split("/").pop()?.slice(0, 18)}...` : "Primera imagen pendiente"}
                    </Text>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {photoArray[1] ? `${photoArray[1].split("/").pop()?.slice(0, 18)}...` : "Segunda imagen pendiente"}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.fileName} numberOfLines={1}>
                    {photoUri ? `${photoUri.split("/").pop()?.slice(0, 22)}...` : "No hay imagen adjunta"}
                  </Text>
                )}
              </View>
              {(photoUri || photoArray.length > 0) ? (
                <IconButton
                  label="Quitar fotografía"
                  variant="danger"
                  size={42}
                  icon={<CircleX size={20} color={colors.danger} />}
                  onPress={() => {
                    setPhotoUri(null);
                    setPhotoArray([]);
                  }}
                />
              ) : null}
            </View>
          </Card>

          <AppButton title="Enviar formulario" icon={<Send size={20} color={colors.white} />} onPress={handlerSend} />
        </Screen>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  card: {
    gap: spacing.md,
  },
  dropdownCard: {
    zIndex: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: "900",
  },
  label: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: "800",
  },
  readonlyBox: {
    minHeight: 52,
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  readonlyText: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    fontWeight: "700",
    lineHeight: 22,
  },
  dropdownContainer: {
    marginBottom: spacing.sm,
    zIndex: 20,
  },
  dropdown: {
    minHeight: 52,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  dropdownList: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  dropdownLabel: {
    color: colors.text,
    fontWeight: "700",
  },
  placeholder: {
    color: colors.textSubtle,
  },
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  noReadingRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noReadingText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: "800",
  },
  noReadingInputDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    color: colors.text,
  },
  fileBox: {
    flex: 1,
    minHeight: 58,
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fileTitle: {
    color: colors.text,
    fontSize: fontSizes.xs,
    fontWeight: "900",
  },
  fileName: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
});
