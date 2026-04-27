import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
//import * as Location from "expo-location";
//import TablaAsignaciones from "@/components/home/TablaAsignaciones";
import TablaAte from "@/components/home/TablaAte";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { router } from "expo-router";
import IndiceUV from "@/components/home/InidiceUV";
export default function HomeScreen() {
  //const [data, setData] = useState([]);
  //const [filtro, setFiltro] = useState([]);
  const {markedDates,setCalendarSelected,asignaciones} = useGlobalContext();
  
  /*const functionFilter = (data: any, selected: string) => {
    const fechaInicio = dayjs(selected);
    const data_filter = data.filter((data: { fecha_asignacion: any; }) => {
      const fechaAsignacion = dayjs(data.fecha_asignacion);
      const useEffect(() => {
    const fetchTiposDocumento = async () => {
      try {
        const response = await fetch('http://blocktype.cl:40000/tipoDocumento/obtenerTipos', {
          headers: {
            Authorization: `Bearer YOUR_TOKEN_HERE`,
          },
        });
        const data = await response.json();
        console.log(data);
      } catch (error) {
        console.error('Error fetching tipos documento:', error);
      }
    };

    fetchTiposDocumento();
  }, []);
  const fetchTiposDocumento = async () => {diferenciaDias = fechaAsignacion.diff(fechaInicio, "day");
      return diferenciaDias >= 0 && diferenciaDias <= 2;
    });
    setFiltro(data_filter);
  };*/

  LocaleConfig.locales["es"] = {
    monthNames: [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ],
    monthNamesShort: [
      "Ene.",
      "Feb.",
      "Mar.",
      "Abr.",
      "May.",
      "Jun.",
      "Jul.",
      "Ago.",
      "Sep.",
      "Oct.",
      "Nov.",
      "Dic.",
    ],
    dayNames: [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ],
    dayNamesShort: ["Dom.", "Lun.", "Mar.", "Mié.", "Jue.", "Vie.", "Sáb."],
    today: "Hoy",
  };
  LocaleConfig.defaultLocale = "es";
  const handleDayPress = (day: { dateString: string }) => {
    const asignacion = asignaciones.find(
      (asignacion) => asignacion.fecha_asignacion === day.dateString
    );
    if (asignacion) {
      setCalendarSelected(asignacion);
      router.push("/(lector)/modalCalendar");
  };
    }
    
  return (
    <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        <IndiceUV />
        {/*<View style={styles.container_Tabla}>
        <TablaAsignaciones data={filtro} />
      </View>*/}
        <View style={styles.container_Tabla}>
          <TablaAte />
        </View>
        <View style={styles.container_calendar}>
          <Calendar
            style={styles.calendar}
            hideExtraDays
            disableArrowLeft
            disableArrowRight
            theme={{
              fontSize: 24, // Tamaño de la fuente del título del mes
              textMonthFontWeight: "bold", // Peso de la fuente del título del mes
              monthTextColor: "black", // Color del título del mes
              textSectionTitleColor: "#3d3d3d", // Color de los días de la semana
            }}
            headerStyle={{
              borderBottomWidth: 1,
              borderBottomColor: "#e7e7e7",
            }}
            onDayPress={(day: any) => {
              handleDayPress(day);
              //functionFilter(data, day.dateString);
            }}
            markedDates={markedDates}
          />
        </View>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e7e7e7",
    gap: 10, //estandarizar
    paddingTop: 15, //estandarizar
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  calendar: {
    width: "100%",
    borderRadius: 16,
    paddingBottom: 10,
  },
  container_Tabla: {
    backgroundColor: "white",
    borderRadius: 12,
    marginHorizontal: 10, //estandarizar
  },
  container_calendar: {
    backgroundColor: "white",
    borderRadius: 12,
    maxHeight: "33%", //estandarizar
    marginHorizontal: 10, //estandarizar
    marginBottom: 10, //estandarizar
  },
  error: {
    color: "red",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    position: "absolute",
    zIndex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "95%",
    minHeight: "35%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  closeButton: {
    position: "absolute",
    right: 10,
    top: 10,
    padding: 10,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
  },
  dataItem: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 10,
    marginTop: 10,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    color: "#333",
    fontWeight: "bold",
  },
  value: {
    fontSize: 16,
    color: "#555",
  },
  btnNoti: {
    width: 50,
    height: 50,
    borderRadius: 50,
    backgroundColor: "#0057b7",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    right: 10,
    top: 10,
    zIndex: 1,
  },
});
