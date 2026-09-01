import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { useAppState } from "../../store/appState";
import { getPalette } from "../../lib/theme";
import { radius, spacing } from "../../lib/design";
import { formatDateLong } from "../../lib/formatters";
import { toDayKey } from "../../lib/salesHistory";
import type { EventFunction } from "../../lib/types";

export type RangePreset = "7d" | "30d" | "all" | "custom";

export type RangeSelection = {
  preset: RangePreset;
  /** Claves `YYYY-MM-DD`; sólo se usan cuando `preset` es "custom". */
  fromKey?: string;
  toKey?: string;
};

export type SheetKind = "functions" | "range" | null;

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "7d", label: "Últimos 7 días" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "all", label: "Todo el período" },
  { id: "custom", label: "Personalizado" },
];

const Option = ({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        paddingHorizontal: 13,
        paddingVertical: 11,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: selected ? palette.primary : palette.border,
        backgroundColor: selected ? palette.surfaceEmphasis : palette.surface,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: selected ? "700" : "500", color: selected ? palette.primary : palette.text }}>
          {label}
        </Text>
        {detail ? <Text style={{ fontSize: 11, color: palette.subtext, marginTop: 1 }}>{detail}</Text> : null}
      </View>
      {selected ? <Feather name="check" size={16} color={palette.primary} /> : null}
    </Pressable>
  );
};

export const HistoryFilterSheet = ({
  kind,
  onClose,
  functions,
  selectedFunctionIds,
  onChangeFunctions,
  range,
  onChangeRange,
}: {
  kind: SheetKind;
  onClose: () => void;
  functions: EventFunction[];
  selectedFunctionIds: string[];
  onChangeFunctions: (ids: string[]) => void;
  range: RangeSelection;
  onChangeRange: (range: RangeSelection) => void;
}) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);

  // Borrador local: los cambios sólo se aplican al confirmar, así "Cancelar"
  // devuelve la pantalla al estado en el que estaba.
  const [draftIds, setDraftIds] = useState<string[]>(selectedFunctionIds);
  const [draftRange, setDraftRange] = useState<RangeSelection>(range);

  React.useEffect(() => {
    if (kind === null) return;
    setDraftIds(selectedFunctionIds);
    setDraftRange(range);
  }, [kind, selectedFunctionIds, range]);

  const markedDates = useMemo(() => {
    if (!draftRange.fromKey) return {};
    const marks: Record<string, object> = {};
    const from = draftRange.fromKey;
    const to = draftRange.toKey ?? draftRange.fromKey;
    const cursor = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    while (cursor.getTime() <= end.getTime()) {
      // `toDayKey` lee la fecha local; `toISOString()` la pasaría a UTC y en
      // husos al este de Greenwich marcaría el día anterior.
      const key = toDayKey(cursor);
      marks[key] = {
        color: palette.primary,
        textColor: "#ffffff",
        startingDay: key === from,
        endingDay: key === to,
      };
      cursor.setDate(cursor.getDate() + 1);
    }
    return marks;
  }, [draftRange.fromKey, draftRange.toKey, palette.primary]);

  const toggleFunction = (id: string) => {
    setDraftIds((current) => {
      if (current.includes(id)) {
        // Nunca se permite dejar la selección vacía: sin ids el endpoint no
        // tiene qué consultar y la pantalla quedaría en blanco sin explicación.
        return current.length === 1 ? current : current.filter((value) => value !== id);
      }
      return [...current, id];
    });
  };

  const apply = () => {
    onChangeFunctions(draftIds);
    onChangeRange(draftRange);
    onClose();
  };

  const pickDay = (key: string) => {
    setDraftRange((current) => {
      const startingOver = !current.fromKey || current.toKey || key < current.fromKey;
      return startingOver
        ? { preset: "custom", fromKey: key, toKey: undefined }
        : { preset: "custom", fromKey: current.fromKey, toKey: key };
    });
  };

  return (
    <Modal visible={kind !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar filtros"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(8,12,20,0.42)" }}
      />
      <View
        style={{
          backgroundColor: palette.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: 28,
          maxHeight: "82%",
        }}
      >
        <View
          style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: palette.border, alignSelf: "center", marginBottom: 14 }}
        />

        <ScrollView showsVerticalScrollIndicator={false}>
          {kind === "functions" ? (
            <>
              <Text style={{ fontSize: 17, fontWeight: "800", color: palette.text }}>Funciones</Text>
              {/* `ids` es un array: varias funciones entran en una sola
                  petición, no una por función. */}
              <Text style={{ fontSize: 12, color: palette.subtext, marginTop: 2, marginBottom: 16 }}>
                Se consultan todas juntas en un solo pedido.
              </Text>
              <View style={{ gap: 6 }}>
                {functions.map((fn) => (
                  <Option
                    key={fn.id}
                    label={formatDateLong(fn.dateISO)}
                    detail={fn.status === "finished" ? "Finalizada" : fn.status === "sold_out" ? "Agotada" : "En venta"}
                    selected={draftIds.includes(fn.id)}
                    onPress={() => toggleFunction(fn.id)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {kind === "range" ? (
            <>
              <Text style={{ fontSize: 17, fontWeight: "800", color: palette.text }}>Rango de fechas</Text>
              <Text style={{ fontSize: 12, color: palette.subtext, marginTop: 2, marginBottom: 16 }}>
                Se filtra sobre el histórico ya descargado: no dispara otro pedido.
              </Text>
              <View style={{ gap: 6 }}>
                {PRESETS.map((preset) => (
                  <Option
                    key={preset.id}
                    label={preset.label}
                    selected={draftRange.preset === preset.id}
                    onPress={() =>
                      setDraftRange(
                        preset.id === "custom"
                          ? { preset: "custom", fromKey: draftRange.fromKey, toKey: draftRange.toKey }
                          : { preset: preset.id },
                      )
                    }
                  />
                ))}
              </View>

              {draftRange.preset === "custom" ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 11, color: palette.subtext, marginBottom: 8 }}>
                    {draftRange.fromKey && !draftRange.toKey
                      ? "Elegí la fecha hasta"
                      : "Tocá la fecha desde y después la fecha hasta"}
                  </Text>
                  <Calendar
                    firstDay={1}
                    markingType="period"
                    markedDates={markedDates}
                    onDayPress={(day: { dateString: string }) => pickDay(day.dateString)}
                    theme={{
                      calendarBackground: palette.surface,
                      dayTextColor: palette.text,
                      monthTextColor: palette.text,
                      textSectionTitleColor: palette.subtext,
                      todayTextColor: palette.primary,
                      arrowColor: palette.primary,
                      textDisabledColor: palette.border,
                    }}
                  />
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 9, marginTop: 14 }}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={{ flex: 1, borderRadius: radius.sm, paddingVertical: 13, alignItems: "center", backgroundColor: palette.surfaceMuted }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: palette.text }}>Cancelar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={apply}
            style={{ flex: 1.4, borderRadius: radius.sm, paddingVertical: 13, alignItems: "center", backgroundColor: palette.primary }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>Aplicar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
