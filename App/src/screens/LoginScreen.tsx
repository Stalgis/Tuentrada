import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
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

  return (
    <SafeAreaView className="flex-1 bg-background-light px-5 pt-8 dark:bg-background-dark">
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-semibold text-text-light dark:text-text-dark">
          {t("loginTitle")}
        </Text>
        <Text className="mt-2 text-base text-subtext-light dark:text-subtext-dark">
          {t("loginSubtitle")}
        </Text>

        <View className="mt-8">
          <Text className="mb-2 text-xs uppercase ml-2 text-subtext-light dark:text-subtext-dark">
            {t("emailLabel")}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="cliente@tuentrada.com"
            className="rounded-2xl border border-border-light bg-card-light px-4 text-base text-text-light dark:border-border-dark dark:bg-card-dark dark:text-text-dark"
            style={{
              height: 50,
              paddingVertical: 12,
              lineHeight: 18,
              textAlignVertical: "center",
            }}
          />
        </View>

        <View className="mt-4">
          <Text className="mb-2 ml-2 text-xs uppercase text-subtext-light dark:text-subtext-dark">
            {t("passwordLabel")}
          </Text>
          <View
            className="flex-row items-center rounded-2xl border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark"
            style={{ minHeight: 50 }}
          >
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              className="flex-1 px-4 text-base text-text-light dark:text-text-dark"
              style={{
                paddingVertical: 12,
                lineHeight: 18,
                textAlignVertical: "center",
              }}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              style={{ paddingHorizontal: 12 }}
              accessibilityLabel={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={showPassword ? "#0f172a" : "#64748b"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {error && <Text className="mt-3 text-sm text-rose-500">{error}</Text>}

        <Button
          label={t("loginButton")}
          className="mt-6"
          onPress={handleSubmit}
          loading={loading}
        />

        <View className="mt-8 rounded-2xl bg-card-light p-4 shadow-card dark:bg-card-dark">
          <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
            {t("tempCredentialsHintTitle")}
          </Text>
          <Text className="mt-1 text-sm text-subtext-light dark:text-subtext-dark">
            {t("tempCredentialsHint")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;
