import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../store/auth";
import { useAppState } from "../store/appState";
import { getPalette } from "../lib/theme";
import { radius, shadow, spacing, typography } from "../lib/design";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

const LoginScreen = () => {
  const { login, loginWithBiometric, loading, biometricEnabled, sessionExpired } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useAppState();
  const palette = getPalette(theme);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const emailError = useMemo(() => {
    if (!emailTouched) return null;
    if (!email.trim()) return "Ingresá tu email.";
    if (!isValidEmail(email)) return "Ingresá un email válido.";
    return null;
  }, [email, emailTouched]);

  const passwordError = useMemo(() => {
    if (!passwordTouched) return null;
    if (!password.trim()) return "Ingresá tu contraseña.";
    if (password.trim().length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    return null;
  }, [password, passwordTouched]);

  const handleSubmit = async () => {
    setEmailTouched(true);
    setPasswordTouched(true);
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError(t("loginMissingFields"));
      return;
    }
    if (!isValidEmail(email)) {
      setError("Revisá el email antes de continuar.");
      return;
    }

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginGenericError"));
    }
  };

  const handleBiometricLogin = async () => {
    setError(null);
    try {
      await loginWithBiometric();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión con biometría.");
    }
  };

  const inputBorder = (hasError: boolean) =>
    hasError ? palette.danger : palette.hairline;

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing["2xl"] }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
          <View>
            <View
              style={{
                height: 300,
                backgroundColor: palette.primary,
                borderBottomLeftRadius: radius.xl + 8,
                borderBottomRightRadius: radius.xl + 8,
                paddingTop: insets.top + spacing.md,
                paddingHorizontal: spacing.xl,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: -60,
                  right: -40,
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  top: 80,
                  left: -50,
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: "rgba(255,255,255,0.05)",
                }}
              />
              <View style={{ alignItems: "center" }}>
                <Image
                  source={require("../assets/images/logos-tuentrada/tuentrada-blanco.png")}
                  resizeMode="contain"
                  style={{ width: 210, height: 58 }}
                />
                <Text
                  style={{
                    ...typography.hero,
                    color: "#ffffff",
                    marginTop: spacing.xl + spacing.sm,
                    textAlign: "center",
                  }}
                >
                  {t("loginTitle")}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.78)",
                    marginTop: spacing.md,
                    textAlign: "center",
                    maxWidth: 300,
                    lineHeight: 20,
                  }}
                >
                  {t("loginSubtitle")}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: -56, paddingHorizontal: spacing.lg }}>
              <SurfaceCard style={{ ...shadow.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl }}>
                <Text style={{ ...typography.title, color: palette.text }}>Acceso</Text>
                <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                  Ingresá con tu cuenta para continuar
                </Text>

                {sessionExpired ? (
                  <View
                    style={{
                      marginTop: spacing.lg,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: palette.warning,
                      backgroundColor: palette.surfaceMuted,
                      paddingHorizontal: spacing.base,
                      paddingVertical: spacing.md,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <Feather name="clock" size={15} color={palette.warning} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: palette.warning }}>
                      Tu sesión expiró. Iniciá sesión nuevamente.
                    </Text>
                  </View>
                ) : null}

                <View style={{ marginTop: spacing.xl }}>
                  <Text
                    style={{
                      ...typography.micro,
                      color: palette.subtext,
                      marginBottom: spacing.sm,
                      letterSpacing: 1,
                    }}
                  >
                    {t("emailLabel")}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: inputBorder(!!emailError),
                      backgroundColor: palette.surfaceMuted,
                      paddingHorizontal: spacing.base,
                      minHeight: 56,
                    }}
                  >
                    <Feather name="mail" size={18} color={emailError ? palette.danger : palette.subtext} />
                    <TextInput
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        if (error) setError(null);
                      }}
                      onBlur={() => setEmailTouched(true)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      placeholder="cliente@tuentrada.com"
                      placeholderTextColor={palette.subtext}
                      style={{
                        marginLeft: spacing.md,
                        flex: 1,
                        fontSize: 15,
                        color: palette.text,
                        paddingVertical: 0,
                        height: 56,
                      }}
                    />
                  </View>
                  {emailError ? (
                    <Text style={{ marginTop: spacing.sm, fontSize: 12, fontWeight: "600", color: palette.danger }}>
                      {emailError}
                    </Text>
                  ) : null}
                </View>

                <View style={{ marginTop: spacing.base }}>
                  <Text
                    style={{
                      ...typography.micro,
                      color: palette.subtext,
                      marginBottom: spacing.sm,
                      letterSpacing: 1,
                    }}
                  >
                    {t("passwordLabel")}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: inputBorder(!!passwordError),
                      backgroundColor: palette.surfaceMuted,
                      paddingHorizontal: spacing.base,
                      minHeight: 56,
                    }}
                  >
                    <Feather name="lock" size={18} color={passwordError ? palette.danger : palette.subtext} />
                    <TextInput
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);
                        if (error) setError(null);
                      }}
                      onBlur={() => setPasswordTouched(true)}
                      secureTextEntry={!showPassword}
                      textContentType="password"
                      placeholder="••••••••"
                      placeholderTextColor={palette.subtext}
                      style={{
                        marginLeft: spacing.md,
                        flex: 1,
                        fontSize: 15,
                        color: palette.text,
                        paddingVertical: 0,
                        height: 56,
                      }}
                    />
                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      hitSlop={8}
                      style={{
                        borderRadius: radius.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.sm,
                      }}
                    >
                      <Feather
                        name={showPassword ? "eye-off" : "eye"}
                        size={18}
                        color={palette.subtext}
                      />
                    </Pressable>
                  </View>
                  {passwordError ? (
                    <Text style={{ marginTop: spacing.sm, fontSize: 12, fontWeight: "600", color: palette.danger }}>
                      {passwordError}
                    </Text>
                  ) : null}
                </View>

                {error ? (
                  <View
                    style={{
                      marginTop: spacing.lg,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: palette.danger,
                      backgroundColor: palette.surfaceMuted,
                      paddingHorizontal: spacing.base,
                      paddingVertical: spacing.md,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: palette.danger }}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={t("loginButton")}
                  style={{
                    marginTop: spacing.xl,
                    backgroundColor: palette.primary,
                    borderRadius: radius.pill,
                    paddingVertical: spacing.base,
                    minHeight: 52,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
                    {loading ? "Verificando acceso..." : t("loginButton")}
                  </Text>
                </Pressable>

                {biometricEnabled ? (
                  <Pressable
                    onPress={handleBiometricLogin}
                    disabled={loading}
                    style={{
                      marginTop: spacing.md,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: palette.hairline,
                      backgroundColor: palette.surfaceMuted,
                      paddingVertical: spacing.base,
                    }}
                  >
                    <Feather name="shield" size={18} color={palette.text} />
                    <Text style={{ marginLeft: spacing.sm, fontSize: 14, fontWeight: "700", color: palette.text }}>
                      Ingresar con biometría
                    </Text>
                  </Pressable>
                ) : null}
              </SurfaceCard>
            </View>
          </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;
