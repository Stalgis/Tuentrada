import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "../components/UI/Button";
import { useAuth } from "../store/auth";
import { useTranslation } from "../hooks/useTranslation";

const LoginScreen = () => {
  const { login, loading } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError(t("loginMissingFields"));
      return;
    }

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginGenericError"));
    }
  };

  const insets = useSafeAreaInsets();


  return (
    <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-[#F5F7FB] dark:bg-background-dark">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="relative flex-1">
          {/* HERO TOP */}
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

    <Text className="mt-8 text-center text-3xl font-extrabold tracking-tight text-white">
      {t("loginTitle")}
    </Text>

    <Text className="mt-3 max-w-[300px] text-center text-sm leading-5 text-white/70">
      {t("loginSubtitle")}
    </Text>
  </View>
</View>

          {/* FORM CARD */}
          <View className="-mt-14 px-5 pb-8">
            <View className="rounded-[28px] bg-white px-5 py-6 shadow-2xl dark:bg-card-dark">
              <Text className="text-lg font-semibold text-[#111827] dark:text-text-dark">
                Acceso
              </Text>
              <Text className="mt-1 text-sm text-slate-500 dark:text-subtext-dark">
                Ingresá con tu cuenta para continuar
              </Text>

              {/* EMAIL */}
              <View className="mt-6">
                <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-subtext-dark">
                  {t("emailLabel")}
                </Text>

                <View
                  className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 dark:border-border-dark dark:bg-background-dark"
                  style={{ minHeight: 56 }}
                >
                  <Feather name="mail" size={18} color="#94A3B8" />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="cliente@tuentrada.com"
                    placeholderTextColor="#94A3B8"
                    className="ml-3 mb-2 flex-1 text-base text-[#111827] dark:text-text-dark"
                    style={{
                      paddingVertical: 0,
                      lineHeight: 20,
                      textAlignVertical: "auto",
                    }}
                  />
                </View>
              </View>

              {/* PASSWORD */}
              <View className="mt-4">
                <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-subtext-dark">
                  {t("passwordLabel")}
                </Text>

                <View
                  className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 dark:border-border-dark dark:bg-background-dark"
                  style={{ minHeight: 56 }}
                >
                  <Feather name="lock" size={18} color="#94A3B8" />

                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    className="ml-3 flex-1 text-base text-[#111827] dark:text-text-dark"
                    style={{
                      paddingVertical: 14,
                      lineHeight: 20,
                      textAlignVertical: "center",
                    }}
                  />

                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityLabel={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    className="pl-2"
                  >
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* EXTRA ROW */}
              <View className="mt-4 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="mr-2 h-2.5 w-2.5 rounded-full bg-[#E11D48]" />
                  <Text className="text-xs text-slate-500 dark:text-subtext-dark">
                    Plataforma segura
                  </Text>
                </View>

                <TouchableOpacity activeOpacity={0.8}>
                  <Text className="text-xs font-semibold text-[#E11D48]">
                    ¿Olvidaste tu contraseña?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ERROR */}
              {error && (
                <Text className="mt-4 text-sm font-medium text-rose-500">
                  {error}
                </Text>
              )}

              {/* BUTTON */}
              <Button
                label={t("loginButton")}
                className="mt-6"
                onPress={handleSubmit}
                loading={loading}
              />

              {/* HINT */}
              <View className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-border-dark dark:bg-background-dark">
                <Text className="text-sm font-semibold text-[#111827] dark:text-text-dark">
                  {t("tempCredentialsHintTitle")}
                </Text>
                <Text className="mt-1 text-sm leading-5 text-slate-500 dark:text-subtext-dark">
                  {t("tempCredentialsHint")}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;