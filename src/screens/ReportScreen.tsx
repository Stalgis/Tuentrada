import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { radius, spacing, typography } from "../lib/design";
import { reportTitle } from "../lib/pushPayload";
import {
  ReportForbiddenError,
  ReportNotFoundError,
  ReportUnavailableError,
  fetchReportSnapshot,
  type ReportSnapshot,
} from "../lib/reportSnapshots";
import { currentGeneration, isCurrentGeneration } from "../lib/session";
import { getPalette } from "../lib/theme";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import type { AppScreenNavigationProp, AppStackParamList } from "../navigation/types";

type ReportRoute = RouteProp<AppStackParamList, "Report">;

/**
 * Las fechas del período llegan como `YYYY-MM-DD`, sin hora. Pasarlas por
 * `new Date(iso)` las lee como medianoche UTC y en Argentina se muestran un día
 * antes, así que se arman como fecha de calendario local.
 */
const formatPeriodDay = (value: string): string => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(+match[1], +match[2] - 1, +match[3]);
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

type ScreenState =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: ReportSnapshot }
  | { kind: "error"; title: string; message: string };

const ReportScreen = () => {
  const navigation = useNavigation<AppScreenNavigationProp>();
  const route = useRoute<ReportRoute>();
  const { theme } = useAppState();
  const { user, accessToken } = useAuth();
  const palette = getPalette(theme);
  const destination = route.params;

  const [state, setState] = useState<ScreenState>({ kind: "loading" });

  const load = useCallback(async () => {
    if (!accessToken) return;
    const gen = currentGeneration();
    setState({ kind: "loading" });

    try {
      const snapshot = await fetchReportSnapshot(accessToken, destination.reportId);
      if (!isCurrentGeneration(gen)) return;
      setState({ kind: "ready", snapshot });
    } catch (error) {
      if (!isCurrentGeneration(gen)) return;

      if (error instanceof ReportUnavailableError) {
        setState({
          kind: "error",
          title: "Informe en preparación",
          message:
            "Todavía no podemos mostrar el contenido de este informe dentro de la app. Mientras tanto podés abrir los datos de la función.",
        });
        return;
      }
      if (error instanceof ReportForbiddenError) {
        setState({
          kind: "error",
          title: "Sin acceso",
          message: "Tu cuenta no tiene acceso a este informe.",
        });
        return;
      }
      if (error instanceof ReportNotFoundError) {
        setState({
          kind: "error",
          title: "Informe no disponible",
          message: "Este informe ya no existe. Podés ver la información actualizada en Eventos.",
        });
        return;
      }
      setState({
        kind: "error",
        title: "No se pudo abrir",
        message: error instanceof Error ? error.message : "Intentá de nuevo en un momento.",
      });
    }
  }, [accessToken, destination.reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const period = useMemo(() => {
    if (!destination.periodStart || !destination.periodEnd) return undefined;
    return `${formatPeriodDay(destination.periodStart)} — ${formatPeriodDay(destination.periodEnd)}`;
  }, [destination.periodEnd, destination.periodStart]);

  const title = reportTitle(destination.type);

  const actionButton = (label: string, icon: keyof typeof Feather.glyphMap, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
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
        <Feather name={icon} size={16} color={palette.primary} />
        <Text
          style={{
            marginLeft: spacing.sm,
            color: palette.primary,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["2xl"] }}>
        <AppHeader
          title={title}
          subtitle="Informe"
          avatarInitials={user?.initials}
          onBackPress={() => navigation.goBack()}
        />

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md + 2 }}>
          <SurfaceCard>
            <Text style={{ ...typography.micro, color: palette.subtext, letterSpacing: 0.6 }}>
              {period ? "Período" : "Identificador"}
            </Text>
            <Text style={{ ...typography.heading, color: palette.text, marginTop: spacing.xs }}>
              {period ?? destination.reportId}
            </Text>
            {state.kind === "ready" && state.snapshot.eventName ? (
              <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                {state.snapshot.eventName}
              </Text>
            ) : null}
          </SurfaceCard>

          {state.kind === "loading" ? (
            <SurfaceCard>
              <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
                <ActivityIndicator color={palette.primary} />
              </View>
            </SurfaceCard>
          ) : null}

          {state.kind === "error" ? (
            <SurfaceCard>
              <Text style={{ ...typography.title, color: palette.text }}>{state.title}</Text>
              <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                {state.message}
              </Text>
              <View style={{ marginTop: spacing.base, gap: spacing.sm }}>
                {destination.functionId
                  ? actionButton("Ver la función", "bar-chart-2", () =>
                      navigation.navigate("FunctionDetail", {
                        functionId: destination.functionId as string,
                      }),
                    )
                  : null}
                {destination.eventId
                  ? actionButton("Ver el evento", "calendar", () =>
                      navigation.navigate("EventDetail", {
                        eventId: destination.eventId as string,
                      }),
                    )
                  : null}
                {actionButton("Reintentar", "refresh-cw", () => {
                  void load();
                })}
              </View>
            </SurfaceCard>
          ) : null}

          {state.kind === "ready" ? (
            <SurfaceCard>
              <Text style={{ ...typography.title, color: palette.text }}>Estado</Text>
              <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                {state.snapshot.status === "ready"
                  ? "Informe generado y listo para leer."
                  : state.snapshot.status === "generating"
                    ? "El informe se está generando."
                    : "El informe no pudo generarse."}
              </Text>
              {state.snapshot.generatedAt ? (
                <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                  Generado el {formatPeriodDay(state.snapshot.generatedAt)}
                </Text>
              ) : null}
            </SurfaceCard>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportScreen;
