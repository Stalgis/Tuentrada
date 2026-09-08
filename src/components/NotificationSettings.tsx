import React from "react";
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import SurfaceCard from "./stitch/SurfaceCard";
import { radius, spacing, typography } from "../lib/design";
import { deviceTimezone, type NotificationCategory } from "../lib/pushApi";
import { getPalette } from "../lib/theme";
import { useAppState } from "../store/appState";
import { usePush } from "../store/push";

/**
 * Horario propuesto para el resumen semanal. Es informativo: el envío lo
 * decide el backend con la zona horaria de la cuenta, no el teléfono.
 */
const WEEKLY_SCHEDULE = "Lunes 09:00";

const CATEGORIES: {
  key: NotificationCategory;
  label: string;
  description: string;
}[] = [
  {
    key: "functionReports",
    label: "Informes de funciones",
    description: "Cuando cierra una función y su informe queda listo.",
  },
  {
    key: "weeklySummary",
    label: "Resumen semanal",
    description: "Un resumen de la semana anterior.",
  },
];

const NotificationSettings = () => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const {
    supported,
    unsupportedReason,
    permission,
    preferences,
    busyCategory,
    error,
    setCategory,
    openSettings,
  } = usePush();

  const blocked = permission === "denied";
  const anyEnabled = preferences.functionReports || preferences.weeklySummary;

  const statusLabel = !supported
    ? "No disponible en este entorno"
    : blocked
      ? "Bloqueadas desde el teléfono"
      : anyEnabled
        ? "Activadas"
        : "Desactivadas";

  const statusColor = !supported || blocked ? palette.warning : anyEnabled ? palette.success : palette.subtext;

  const handleToggle = (category: NotificationCategory, next: boolean) => {
    if (!next) {
      void setCategory(category, false);
      return;
    }

    // Explicación antes del permiso: iOS deja preguntar una sola vez y no
    // queremos gastar esa oportunidad en un diálogo sin contexto.
    if (permission === "undetermined") {
      Alert.alert(
        "Avisos de informes",
        "Te vamos a avisar cuando un informe esté listo. Nunca mostramos recaudación ni datos de compradores en el aviso.",
        [
          { text: "Ahora no", style: "cancel" },
          { text: "Continuar", onPress: () => void setCategory(category, true) },
        ],
      );
      return;
    }

    void setCategory(category, true);
  };

  return (
    <SurfaceCard>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...typography.title, color: palette.text }}>Notificaciones</Text>
        <Text style={{ ...typography.caption, color: statusColor }}>{statusLabel}</Text>
      </View>
      <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
        Avisos cuando un informe queda listo. El aviso abre el informe; nunca incluye
        importes ni datos de compradores.
      </Text>

      <View style={{ marginTop: spacing.base, gap: spacing.md }}>
        {CATEGORIES.map((category) => (
          <View
            key={category.key}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.label, color: palette.text }}>{category.label}</Text>
              <Text style={{ ...typography.body, color: palette.subtext, marginTop: 2 }}>
                {category.description}
              </Text>
            </View>
            {busyCategory === category.key ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <Switch
                value={preferences[category.key]}
                onValueChange={(next) => handleToggle(category.key, next)}
                disabled={!supported || busyCategory !== null}
                trackColor={{ false: palette.muted, true: palette.primarySoft }}
                thumbColor={preferences[category.key] ? palette.primary : undefined}
                accessibilityLabel={category.label}
              />
            )}
          </View>
        ))}
      </View>

      {preferences.weeklySummary ? (
        <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.md }}>
          Resumen: {WEEKLY_SCHEDULE} · {deviceTimezone()}
        </Text>
      ) : null}

      {error ? (
        <Text style={{ ...typography.body, color: palette.danger, marginTop: spacing.md }}>
          {error}
        </Text>
      ) : null}

      {!supported && unsupportedReason ? (
        <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.md }}>
          {unsupportedReason}
        </Text>
      ) : null}

      {blocked ? (
        <Pressable
          onPress={() => void openSettings()}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, marginTop: spacing.base })}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: palette.surfaceMuted,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md + 2,
            }}
          >
            <Feather name="settings" size={16} color={palette.primary} />
            <Text
              style={{
                marginLeft: spacing.sm,
                color: palette.primary,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              Abrir configuración del dispositivo
            </Text>
          </View>
        </Pressable>
      ) : null}
    </SurfaceCard>
  );
};

export default NotificationSettings;
