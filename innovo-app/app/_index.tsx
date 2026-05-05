import React, { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatRut } from "react-rut-formatter";
import * as NavigationBar from "expo-navigation-bar";
import { router } from "expo-router";
import { LockKeyhole, UserRound } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthProvider";
import { AppButton, Card, Field } from "@/components/ui";
import { colors, fontSizes, radius, shadows, spacing } from "@/constants/theme";

NavigationBar.setVisibilityAsync("hidden");

const sanitizeRutInput = (value: string) =>
  value.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);

const normalizeRut = (value: string) =>
  value.replace(/[^0-9kK]/g, "").toUpperCase();

const isValidChileanRut = (value: string) => {
  const normalizedRut = normalizeRut(value);
  const body = normalizedRut.slice(0, -1);
  const checkDigit = normalizedRut.slice(-1);

  if (!/^\d{1,8}$/.test(body) || !/^[0-9K]$/.test(checkDigit)) {
    return false;
  }

  let multiplier = 2;
  const sum = [...body].reverse().reduce((acc, digit) => {
    const next = acc + Number(digit) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
    return next;
  }, 0);

  const remainder = 11 - (sum % 11);
  const expectedDigit =
    remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);

  return expectedDigit === checkDigit;
};

export default function IndexScreen() {
  const { login, isAuthenticated } = useAuth();
  const [rut, setRut] = useState("");
  const [rutError, setRutError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  const handleRutChange = (text: string) => {
    const sanitizedRut = sanitizeRutInput(text);
    const formattedRut = formatRut(sanitizedRut);

    setRut(formattedRut);
    if (rutError) {
      setRutError(null);
    }
  };

  const handleLogin = async () => {
    if (!rut || !password) {
      alert("Por favor, complete todos los campos.");
      return;
    }

    if (!isValidChileanRut(rut)) {
      setRutError("Ingresa un RUT chileno válido, con dígito verificador.");
      return;
    }

    setSubmitting(true);
    try {
      await login(rut, password);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const timeout = setTimeout(() => {
      router.dismissTo("/(lector)/home");
    }, 400);

    return () => clearTimeout(timeout);
  }, [isAuthenticated]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: "height" })}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.hero}>
          <View style={styles.logoShell}>
            <Image source={require("@/assets/images/icon.png")} style={styles.logo} />
          </View>
          <Text style={styles.brand}>Innovo App</Text>
          <Text style={styles.heroCopy}>
            Operación en terreno para lecturas, rutas y atenciones especiales.
          </Text>
        </View>

        <Card style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Iniciar sesión</Text>
            <Text style={styles.formSubtitle}>Ingresa tus credenciales de trabajador.</Text>
          </View>

          <Field
            label="RUT"
            placeholder="12.345.678-9"
            leftIcon={<UserRound size={18} color={colors.textMuted} />}
            keyboardType="default"
            autoCapitalize="characters"
            value={rut}
            onChangeText={handleRutChange}
            maxLength={12}
            helper={rutError || "Formato chileno: 12.345.678-9 o 12.345.678-K"}
          />

          <Field
            label="Contraseña"
            placeholder="Ingresa tu contraseña"
            leftIcon={<LockKeyhole size={18} color={colors.textMuted} />}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            maxLength={20}
          />

          <AppButton title="Ingresar" onPress={handleLogin} loading={isSubmitting} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xl,
  },
  hero: {
    minHeight: 280,
    borderRadius: radius.xxl,
    backgroundColor: colors.brand,
    padding: spacing.xxl,
    justifyContent: "flex-end",
    overflow: "hidden",
    ...shadows.floating,
  },
  logoShell: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  logo: {
    width: 74,
    height: 74,
  },
  brand: {
    color: colors.white,
    fontSize: fontSizes.display,
    fontWeight: "900",
  },
  heroCopy: {
    color: "#d6e9ff",
    fontSize: fontSizes.md,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  formCard: {
    gap: spacing.lg,
  },
  formHeader: {
    gap: spacing.xs,
  },
  formTitle: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: "900",
  },
  formSubtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  },
});
