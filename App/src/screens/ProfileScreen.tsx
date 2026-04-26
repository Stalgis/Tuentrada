import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppStackParamList } from "../navigation/types";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { useTranslation } from "../hooks/useTranslation";
import { getPalette } from "../lib/theme";

const ProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user, biometricEnabled, disableBiometric, logout } = useAuth();
  const {
    themePreference,
    setTheme,
    theme,
  } = useAppState();
  const { t } = useTranslation();
  const palette = getPalette(theme);

  const handleSignOut = () => {
    Alert.alert(
      t('signOutConfirmTitle'),
      t('signOutConfirmMessage'),
      [
        { text: t('signOutConfirmCancel'), style: 'cancel' },
        {
          text: t('signOut'),
          style: 'destructive',
          onPress: () => { logout(); },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <AppHeader title="Perfil" subtitle="Preferencias" onBackPress={() => navigation.goBack()} />
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 24, fontWeight: "800" }}>{user?.name ?? "Dashboard Preview"}</Text>
            <Text style={{ color: palette.subtext, fontSize: 14, marginTop: 6 }}>{user?.email ?? "preview@tuentrada.com"}</Text>
          </SurfaceCard>

          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Apariencia</Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
              Cambiá entre modo claro, oscuro o sistema.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              {[
                { key: "light", label: "Claro" },
                { key: "dark", label: "Oscuro" },
                { key: "system", label: "Sistema" },
              ].map((option) => {
                const active = themePreference === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setTheme(option.key as typeof themePreference)}
                    style={{
                      backgroundColor: active ? palette.primary : palette.surfaceMuted,
                      borderRadius: 999,
                      paddingHorizontal: 16,
                      paddingVertical: 11,
                    }}
                  >
                    <Text style={{ color: active ? "#fff" : palette.subtext, fontWeight: "700" }}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>{t("securityTitle")}</Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>{t("securityBody")}</Text>
            {biometricEnabled ? (
              <Pressable
                onPress={disableBiometric}
                style={{
                  marginTop: 16,
                  backgroundColor: palette.surfaceMuted,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <Text style={{ color: palette.text, fontWeight: "700" }}>{t("faceIdDisable")}</Text>
              </Pressable>
            ) : null}
          </SurfaceCard>

          <Pressable
            onPress={handleSignOut}
            style={{
              backgroundColor: palette.primary,
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 6,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{t("signOut")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
