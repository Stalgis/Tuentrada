import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "../components/UI/Button";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../store/auth";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

const LoginScreen = () => {
  const { login, loginWithBiometric, loading, biometricEnabled } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const emailError = useMemo(() => {
    if (!emailTouched) {
      return null;
    }

    if (!email.trim()) {
      return t("emailLabel");
    }

    if (!isValidEmail(email)) {
      return "Ingresá un email válido.";
    }

    return null;
  }, [email, emailTouched, t]);

  const passwordError = useMemo(() => {
    if (!passwordTouched) {
      return null;
    }

    if (!password.trim()) {
      return t("passwordLabel");
    }

    if (password.trim().length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }

    return null;
  }, [password, passwordTouched, t]);

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

  const emailFieldClasses = emailError
    ? "border-rose-400 bg-rose-50"
    : "border-slate-200 bg-white";
  const passwordFieldClasses = passwordError
    ? "border-rose-400 bg-rose-50"
    : "border-slate-200 bg-white";

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-[#F8FAFC] dark:bg-background-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1">
            <View
              className="relative h-[320px] overflow-hidden rounded-b-[36px] bg-[#111827] px-6"
              style={{ paddingTop: insets.top + 12 }}
            >
              <View className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-[#E11D48]/20" />
              <View className="absolute top-20 -left-12 h-32 w-32 rounded-full bg-[#8B5CF6]/20" />
              <View className="absolute bottom-4 right-8 h-24 w-24 rounded-full bg-white/5" />

              <View className="items-center">
                <Image
                  source={require("../assets/images/logos-tuentrada/tuentrada-blanco.png")}
                  resizeMode="contain"
                  style={{ width: 210, height: 58 }}
                />

                <Text className="mt-8 text-[32px] font-extrabold tracking-tight text-white">
                  {t("loginTitle")}
                </Text>

                <Text className="mt-3 max-w-[300px] text-center text-sm leading-5 text-white/70">
                  {t("loginSubtitle")}
                </Text>
              </View>
            </View>

            <View className="-mt-14 flex-1 px-5">
              <View className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-xl dark:border-border-dark dark:bg-card-dark">
                <Text className="text-lg font-semibold text-[#111827] dark:text-text-dark">
                  Acceso
                </Text>
                <Text className="mt-1 text-sm text-slate-500 dark:text-subtext-dark">
                  Ingresá con tu cuenta para continuar
                </Text>

                <View className="mt-6">
                  <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-[1px] text-slate-500 dark:text-subtext-dark">
                    {t("emailLabel")}
                  </Text>
                  <View
                    className={`min-h-14 flex-row items-center rounded-2xl border px-4 ${emailFieldClasses} dark:border-border-dark dark:bg-background-dark`}
                  >
                    <Feather name="mail" size={18} color={emailError ? "#e11d48" : "#64748B"} />
                    <TextInput
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        if (error) {
                          setError(null);
                        }
                      }}
                      onBlur={() => setEmailTouched(true)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      placeholder="cliente@tuentrada.com"
                      placeholderTextColor="#94A3B8"
                      className="ml-3 flex-1 text-base text-[#0F172A] dark:text-text-dark"
                      style={{ height: 56, paddingVertical: 0 }}
                    />
                  </View>
                  {emailError ? (
                    <Text className="mt-2 ml-1 text-xs font-medium text-rose-500">
                      {emailError === t("emailLabel") ? "Ingresá tu email." : emailError}
                    </Text>
                  ) : null}
                </View>

                <View className="mt-4">
                  <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-[1px] text-slate-500 dark:text-subtext-dark">
                    {t("passwordLabel")}
                  </Text>
                  <View
                    className={`min-h-14 flex-row items-center rounded-2xl border px-4 ${passwordFieldClasses} dark:border-border-dark dark:bg-background-dark`}
                  >
                    <Feather name="lock" size={18} color={passwordError ? "#e11d48" : "#64748B"} />
                    <TextInput
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);
                        if (error) {
                          setError(null);
                        }
                      }}
                      onBlur={() => setPasswordTouched(true)}
                      secureTextEntry={!showPassword}
                      textContentType="password"
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      className="ml-3 flex-1 text-base text-[#0F172A] dark:text-text-dark"
                      style={{ height: 56, paddingVertical: 0 }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="rounded-xl bg-slate-100 px-2 py-2"
                    >
                      <Feather
                        name={showPassword ? "eye-off" : "eye"}
                        size={18}
                        color="#475569"
                      />
                    </TouchableOpacity>
                  </View>
                  {passwordError ? (
                    <Text className="mt-2 ml-1 text-xs font-medium text-rose-500">
                      {passwordError === t("passwordLabel") ? "Ingresá tu contraseña." : passwordError}
                    </Text>
                  ) : null}
                </View>

                {error ? (
                  <View className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <Text className="text-sm font-medium text-rose-600">{error}</Text>
                  </View>
                ) : null}

                <Button
                  label={loading ? "Verificando acceso..." : t("loginButton")}
                  className="mt-6 min-h-14 rounded-2xl bg-primary-600"
                  onPress={handleSubmit}
                  loading={loading}
                />

                {biometricEnabled ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleBiometricLogin}
                    disabled={loading}
                    className="mt-3 min-h-14 flex-row items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 dark:border-border-dark dark:bg-background-dark"
                  >
                    <Feather name="shield" size={18} color="#0F172A" />
                    <Text className="ml-2 text-sm font-semibold text-[#111827] dark:text-text-dark">
                      Ingresar con biometría
                    </Text>
                  </TouchableOpacity>
                ) : null}

              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
