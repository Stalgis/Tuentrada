import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { CumulativeChart, DailyBars } from "../components/history/HistoryCharts";
import { HistoryCalendar } from "../components/history/HistoryCalendar";
import {
  HistoryFilterSheet,
  type RangeSelection,
  type SheetKind,
} from "../components/history/HistoryFilterSheet";
import { fetchHistoryFor, fetchSectors } from "../lib/apiClient";
import {
  buildDailySeries,
  cumulative,
  keyDaysBefore,
  quantileCuts,
  sliceSeries,
  summarizeHistory,
  topDays,
  type DailySale,
} from "../lib/salesHistory";
import {
  formatCompactARS,
  formatCompactInteger,
  formatCurrencyARS,
  formatInteger,
} from "../lib/formatters";
import { getPalette } from "../lib/theme";
import { radius, spacing } from "../lib/design";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import type { AppScreenNavigationProp, AppStackParamList } from "../navigation/types";

type HistoryRoute = RouteProp<AppStackParamList, "SalesHistory">;
type ViewMode = "curva" | "calendario" | "tabla";
type Unit = "tickets" | "money";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const shortDay = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const longDay = (date: Date) => `${date.getDate()} de ${MONTHS[date.getMonth()]}`;

const SalesHistoryScreen = () => {
  const navigation = useNavigation<AppScreenNavigationProp>();
  const route = useRoute<HistoryRoute>();
  const { theme, events, loadEvents } = useAppState();
  const { accessToken, user } = useAuth();
  const palette = getPalette(theme);

  const { eventId, functionId } = route.params;

  const [rows, setRows] = useState<DailySale[]>([]);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [view, setView] = useState<ViewMode>("curva");
  const [unit, setUnit] = useState<Unit>("tickets");
  const [range, setRange] = useState<RangeSelection>({ preset: "all" });
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (events.status === "idle" && accessToken) loadEvents(accessToken);
  }, [events.status, loadEvents, accessToken]);

  const event = useMemo(() => events.data.find((e) => e.id === eventId), [events.data, eventId]);
  const functions = useMemo(() => event?.functions ?? [], [event]);

  const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>(
    functionId ? [functionId] : [],
  );

  // El catálogo puede llegar después de montar la pantalla. En cuanto están las
  // funciones, si no hubo elección explícita se consultan todas.
  useEffect(() => {
    if (selectedFunctionIds.length > 0 || functions.length === 0) return;
    setSelectedFunctionIds(functions.map((fn) => fn.id));
  }, [functions, selectedFunctionIds.length]);

  const idsKey = selectedFunctionIds.join(",");

  useEffect(() => {
    if (!accessToken || selectedFunctionIds.length === 0) return;

    // Una respuesta que llega después de cambiar de filtro (o de desmontar) no
    // debe pisar el estado de la consulta vigente.
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchHistoryFor(accessToken, selectedFunctionIds, "all")
      .then((result) => {
        if (cancelled) return;
        setRows(buildDailySeries(result.rows));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof Error ? err.message : "No pudimos cargar el histórico.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, idsKey, reloadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // El aforo sólo tiene sentido con una función a la vez: sumarlo entre varias
  // mezclaría salas distintas. Es una petición aparte porque el histórico no lo
  // devuelve.
  useEffect(() => {
    if (!accessToken || selectedFunctionIds.length !== 1) {
      setCapacity(null);
      return;
    }
    let cancelled = false;
    fetchSectors(accessToken, selectedFunctionIds[0])
      .then((sectors) => {
        if (cancelled) return;
        const totalRow = sectors.find((sector) => sector.is_total_general);
        setCapacity(totalRow && totalRow.total > 0 ? totalRow.total : null);
      })
      .catch(() => {
        // Sin aforo la curva sigue sirviendo: pierde el techo, no el sentido.
        if (!cancelled) setCapacity(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    if (range.preset === "custom") return sliceSeries(rows, range.fromKey, range.toKey);
    if (range.preset === "7d") return sliceSeries(rows, keyDaysBefore(rows, 7));
    if (range.preset === "30d") return sliceSeries(rows, keyDaysBefore(rows, 30));
    return rows;
  }, [rows, range]);

  const summary = useMemo(() => summarizeHistory(visible), [visible]);
  const cuts = useMemo(
    () => quantileCuts(visible.filter((day) => day.hasData).map((day) => day.net)),
    [visible],
  );
  const cumulativeValues = useMemo(() => {
    const running = cumulative(visible);
    return unit === "money" ? running.net : running.tickets;
  }, [visible, unit]);

  const selectedIndex = useMemo(() => {
    const found = visible.findIndex((day) => day.key === selectedKey);
    return found >= 0 ? found : Math.max(0, visible.length - 1);
  }, [visible, selectedKey]);
  const selectedDay = visible[selectedIndex] ?? null;

  const selectByIndex = useCallback(
    (index: number) => {
      const day = visible[index];
      if (day) setSelectedKey(day.key);
    },
    [visible],
  );

  const formatUnit = useCallback(
    (value: number) => (unit === "money" ? formatCompactARS(value) : formatCompactInteger(value)),
    [unit],
  );

  const rangeLabel =
    range.preset === "7d"
      ? "Últimos 7 días"
      : range.preset === "30d"
        ? "Últimos 30 días"
        : range.preset === "custom"
          ? "Rango personalizado"
          : "Todo el período";

  const functionsLabel =
    selectedFunctionIds.length === functions.length && functions.length > 1
      ? `Todas las funciones (${functions.length})`
      : selectedFunctionIds.length === 1
        ? "1 función"
        : `${selectedFunctionIds.length} funciones`;

  const renderChip = (label: string, kind: Exclude<SheetKind, null>, active: boolean) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => setSheet(kind)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? palette.primarySoft : palette.border,
        backgroundColor: active ? palette.surfaceEmphasis : palette.surface,
      }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: active ? palette.primary : palette.text }}>
        {label}
      </Text>
      <Feather name="chevron-down" size={12} color={active ? palette.primary : palette.subtext} />
    </Pressable>
  );

  const segmented = (
    <View
      style={{
        flexDirection: "row",
        gap: 3,
        backgroundColor: palette.muted,
        borderRadius: 11,
        padding: 3,
        marginTop: 11,
      }}
    >
      {(["curva", "calendario", "tabla"] as ViewMode[]).map((mode) => {
        const active = view === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => setView(mode)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 7,
              borderRadius: 9,
              backgroundColor: active ? palette.surface : "transparent",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: active ? palette.text : palette.subtext }}>
              {mode === "curva" ? "Curva" : mode === "calendario" ? "Calendario" : "Tabla"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const kpi = (label: string, value: string, foot: string) => (
    <View style={{ flex: 1, minWidth: "46%" }}>
      <SurfaceCard style={{ borderRadius: radius.md, padding: 13 }}>
        <Text style={{ fontSize: 11, color: palette.subtext, fontWeight: "500" }}>{label}</Text>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "800",
            letterSpacing: -0.6,
            color: palette.text,
            marginTop: 3,
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
        <Text style={{ fontSize: 10.5, color: palette.subtext, marginTop: 3 }}>{foot}</Text>
      </SurfaceCard>
    </View>
  );

  const dayCard = selectedDay ? (
    <SurfaceCard tone="hero" style={{ marginTop: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 15, fontWeight: "800", color: palette.text }}>{longDay(selectedDay.date)}</Text>
          <Text style={{ fontSize: 11.5, color: palette.subtext }}>{WEEKDAYS[selectedDay.date.getDay()]}</Text>
        </View>
        <Text style={{ fontSize: 11.5, color: palette.subtext }}>
          {`día ${selectedIndex + 1} de ${visible.length}`}
        </Text>
      </View>

      {selectedDay.hasData ? (
        <>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              letterSpacing: -0.7,
              color: palette.text,
              marginTop: 8,
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatCurrencyARS(selectedDay.net)}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {[
              ["Vendidos", selectedDay.sold],
              ["Invitaciones", selectedDay.guests],
              ["Total", selectedDay.total],
            ].map(([label, value]) => (
              <View
                key={label as string}
                style={{ flex: 1, backgroundColor: palette.surface, borderRadius: radius.sm, padding: 10 }}
              >
                <Text style={{ fontSize: 10.5, color: palette.subtext }}>{label as string}</Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: palette.text,
                    marginTop: 2,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatInteger(value as number)}
                </Text>
              </View>
            ))}
          </View>
          {/* `total_net` sólo cuenta lo vendido: dividirlo por las entradas
              emitidas da un precio promedio que nunca existió. */}
          <Text style={{ fontSize: 11.5, color: palette.subtext, marginTop: 11 }}>
            {selectedDay.guests > 0
              ? `${formatInteger(selectedDay.guests)} invitaciones no facturan: el promedio real es ${formatCurrencyARS(
                  selectedDay.net / selectedDay.sold,
                )} por entrada vendida.`
              : selectedDay.sold > 0
                ? `${formatCurrencyARS(selectedDay.net / selectedDay.sold)} promedio por entrada.`
                : "Sin ventas registradas este día."}
          </Text>
        </>
      ) : (
        <>
          <Text style={{ fontSize: 22, fontWeight: "800", color: palette.subtext, marginTop: 8 }}>Sin datos</Text>
          <Text style={{ fontSize: 11.5, color: palette.subtext, marginTop: 8 }}>
            El backend no devuelve fila para esta fecha, que no es lo mismo que un día con cero ventas.
          </Text>
        </>
      )}
    </SurfaceCard>
  ) : null;

  const curvaContent = (
    <>
      <SurfaceCard>
        <Text style={{ fontSize: 12, color: palette.subtext, fontWeight: "500" }}>Recaudación del período</Text>
        <Text
          style={{
            fontSize: 34,
            fontWeight: "800",
            letterSpacing: -1,
            color: palette.text,
            marginTop: 3,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatCurrencyARS(summary.totalNet)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
          {summary.deltaPct != null ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: summary.deltaPct >= 0 ? `${palette.success}29` : `${palette.danger}29`,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: summary.deltaPct >= 0 ? palette.success : palette.danger,
                }}
              >
                {`${summary.deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(summary.deltaPct)}%`}
              </Text>
            </View>
          ) : null}
          <Text style={{ fontSize: 11.5, color: palette.subtext }}>
            {summary.deltaPct != null
              ? "últimos 7 días vs. 7 anteriores"
              : "la semana anterior no tuvo ventas para comparar"}
          </Text>
        </View>
        <Text style={{ fontSize: 11.5, color: palette.subtext, marginTop: 6 }}>
          {capacity
            ? `${formatInteger(summary.totalTickets)} de ${formatInteger(capacity)} localidades · ${Math.round(
                (summary.totalTickets / capacity) * 100,
              )}% del aforo`
            : `${formatInteger(summary.totalTickets)} entradas emitidas`}
        </Text>
      </SurfaceCard>

      <SurfaceCard style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: palette.text }}>Venta acumulada</Text>
            <Text style={{ fontSize: 11.5, color: palette.subtext }}>Arrastrá sobre el gráfico para ver un día</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 2, backgroundColor: palette.muted, borderRadius: 8, padding: 2 }}>
            {(["tickets", "money"] as Unit[]).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="tab"
                accessibilityState={{ selected: unit === option }}
                onPress={() => setUnit(option)}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: unit === option ? palette.surface : "transparent",
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "700", color: unit === option ? palette.text : palette.subtext }}
                >
                  {option === "tickets" ? "Tickets" : "$"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <CumulativeChart
            values={cumulativeValues}
            selectedIndex={selectedIndex}
            capacity={unit === "tickets" && capacity ? capacity : undefined}
            onSelect={selectByIndex}
            formatValue={formatUnit}
          />
        </View>

        <Text style={{ fontSize: 12.5, fontWeight: "700", color: palette.text, marginTop: 14 }}>Por día</Text>
        <DailyBars
          series={visible}
          valueOf={(day) => (unit === "money" ? day.net : day.total)}
          selectedIndex={selectedIndex}
          onSelect={selectByIndex}
          formatValue={formatUnit}
        />
        <Text style={{ fontSize: 11.5, color: palette.subtext, marginTop: 6 }}>
          Escala cortada en el percentil 95; las barras que la superan van marcadas y rotuladas.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
          {visible.length > 0 ? (
            <>
              <Text style={{ fontSize: 10, color: palette.subtext }}>{shortDay(visible[0].date)}</Text>
              <Text style={{ fontSize: 10, color: palette.subtext }}>
                {shortDay(visible[Math.floor(visible.length / 2)].date)}
              </Text>
              <Text style={{ fontSize: 10, color: palette.subtext }}>
                {shortDay(visible[visible.length - 1].date)}
              </Text>
            </>
          ) : null}
        </View>
      </SurfaceCard>

      {dayCard}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: spacing.md }}>
        {kpi("Últimos 7 días", formatInteger(summary.last7), `antes ${formatInteger(summary.prev7)}`)}
        {kpi(
          "Mejor día",
          summary.bestDay ? formatInteger(summary.bestDay.total) : "—",
          summary.bestDay ? `${shortDay(summary.bestDay.date)} · ${formatCompactARS(summary.bestDay.net)}` : "sin datos",
        )}
        {kpi(
          "Promedio diario",
          formatInteger(summary.averageExcludingLaunch),
          summary.launchDay ? `sin el ${shortDay(summary.launchDay.date)}, día de salida` : "por día con datos",
        )}
        {kpi(
          "Días con datos",
          `${summary.daysWithData} de ${summary.daysInSpan}`,
          summary.daysWithData < summary.daysInSpan ? "el backend omite días sin movimiento" : "sin huecos",
        )}
      </View>

      <SurfaceCard style={{ marginTop: spacing.md }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: palette.text }}>Top 5 días</Text>
        {topDays(visible, 5).map((day, position) => (
          <Pressable
            key={day.key}
            accessibilityRole="button"
            onPress={() => setSelectedKey(day.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 10,
              borderTopWidth: position === 0 ? 0 : 1,
              borderTopColor: palette.hairline,
            }}
          >
            <Text style={{ width: 16, fontSize: 11, fontWeight: "800", color: palette.subtext }}>{position + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: palette.text }}>{longDay(day.date)}</Text>
              <Text style={{ fontSize: 11, color: palette.subtext }}>
                {`${WEEKDAYS[day.date.getDay()]} · ${formatInteger(day.total)} entradas`}
              </Text>
            </View>
            <Text
              style={{ fontSize: 13.5, fontWeight: "800", color: palette.text, fontVariant: ["tabular-nums"] }}
            >
              {formatCompactARS(day.net)}
            </Text>
          </Pressable>
        ))}
      </SurfaceCard>
    </>
  );

  const calendarioContent = (
    <>
      <SurfaceCard>
        <Text style={{ fontSize: 14, fontWeight: "700", color: palette.text }}>Recaudación por día</Text>
        <Text style={{ fontSize: 11.5, color: palette.subtext }}>Escala por cuantiles del período filtrado</Text>
        <HistoryCalendar
          series={visible}
          cuts={cuts}
          selectedKey={selectedDay?.key ?? null}
          onSelect={selectByIndex}
        />
        <View style={{ backgroundColor: palette.muted, borderRadius: radius.sm, padding: 11, marginTop: 12 }}>
          <Text style={{ fontSize: 11, color: palette.subtext, lineHeight: 16 }}>
            Un solo tono, no semáforo: la intensidad dice más o menos que los demás días, no «bien o mal». Los cortes se
            recalculan con cada filtro. Las fechas con «–» son las que el backend no devuelve.
          </Text>
        </View>
      </SurfaceCard>
      {dayCard}
    </>
  );

  const header = (
    <View>
      <AppHeader
        title="Histórico por día"
        subtitle={event?.name}
        onBackPress={() => navigation.goBack()}
        avatarInitials={user?.initials}
        onAvatarPress={() => navigation.navigate("Profile")}
      />
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
          {functions.length > 0 ? renderChip(functionsLabel, "functions", true) : null}
          {renderChip(rangeLabel, "range", range.preset !== "all")}
        </View>
        {segmented}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : error ? (
          <SurfaceCard>
            <Text style={{ fontSize: 14, fontWeight: "700", color: palette.text }}>No pudimos cargar el histórico</Text>
            <Text style={{ fontSize: 12.5, color: palette.subtext, marginTop: 4 }}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReloadToken((value) => value + 1)}
              style={{
                marginTop: 12,
                alignSelf: "flex-start",
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: radius.sm,
                backgroundColor: palette.primary,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff" }}>Reintentar</Text>
            </Pressable>
          </SurfaceCard>
        ) : visible.length === 0 ? (
          <SurfaceCard>
            <Text style={{ fontSize: 14, fontWeight: "700", color: palette.text }}>Sin ventas en este rango</Text>
            <Text style={{ fontSize: 12.5, color: palette.subtext, marginTop: 4 }}>
              Probá con otro rango de fechas o con otra función.
            </Text>
          </SurfaceCard>
        ) : view === "curva" ? (
          curvaContent
        ) : view === "calendario" ? (
          calendarioContent
        ) : (
          <View style={{ flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <Text style={{ width: 58, fontSize: 10, fontWeight: "700", color: palette.subtext }}>DÍA</Text>
            <Text style={{ flex: 1, textAlign: "right", fontSize: 10, fontWeight: "700", color: palette.subtext }}>
              VEND.
            </Text>
            <Text style={{ flex: 1, textAlign: "right", fontSize: 10, fontWeight: "700", color: palette.subtext }}>
              INVIT.
            </Text>
            <Text style={{ flex: 1.6, textAlign: "right", fontSize: 10, fontWeight: "700", color: palette.subtext }}>
              RECAUDACIÓN
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <FlatList
        data={view === "tabla" && !loading && !error ? visible : []}
        keyExtractor={(day) => day.key}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedKey(item.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginHorizontal: spacing.lg,
              paddingVertical: 9,
              borderBottomWidth: 1,
              borderBottomColor: palette.hairline,
            }}
          >
            <Text style={{ width: 58, fontSize: 11.5, color: palette.subtext, fontVariant: ["tabular-nums"] }}>
              {shortDay(item.date)}
            </Text>
            {item.hasData ? (
              <>
                <Text style={{ flex: 1, textAlign: "right", fontSize: 12.5, color: palette.text, fontVariant: ["tabular-nums"] }}>
                  {formatInteger(item.sold)}
                </Text>
                <Text style={{ flex: 1, textAlign: "right", fontSize: 12.5, color: palette.text, fontVariant: ["tabular-nums"] }}>
                  {formatInteger(item.guests)}
                </Text>
                <Text
                  style={{
                    flex: 1.6,
                    textAlign: "right",
                    fontSize: 12.5,
                    fontWeight: "700",
                    color: item.net > cuts[3] ? palette.primary : palette.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatCurrencyARS(item.net)}
                </Text>
              </>
            ) : (
              <Text style={{ flex: 3.6, textAlign: "right", fontSize: 12, fontStyle: "italic", color: palette.subtext }}>
                sin datos
              </Text>
            )}
          </Pressable>
        )}
      />

      <HistoryFilterSheet
        kind={sheet}
        onClose={() => setSheet(null)}
        functions={functions}
        selectedFunctionIds={selectedFunctionIds}
        onChangeFunctions={setSelectedFunctionIds}
        range={range}
        onChangeRange={setRange}
      />
    </SafeAreaView>
  );
};

export default SalesHistoryScreen;
