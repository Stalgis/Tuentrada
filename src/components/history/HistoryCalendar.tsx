import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppState } from "../../store/appState";
import { getPalette } from "../../lib/theme";
import { formatCompactARS, formatCurrencyARS } from "../../lib/formatters";
import { bucketFor, type DailySale } from "../../lib/salesHistory";
import { getHeatScale } from "./heatColors";

// La semana arranca el lunes, como el resto de la app y como la web.
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;
/** Clave `YYYY-MM` a partir de la clave diaria `YYYY-MM-DD`. */
const monthOf = (dayKey: string) => dayKey.slice(0, 7);
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export const HistoryCalendar = ({
  series,
  cuts,
  selectedKey,
  onSelect,
}: {
  series: DailySale[];
  cuts: number[];
  selectedKey: string | null;
  onSelect: (index: number) => void;
}) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const heat = getHeatScale(theme);

  // Índice por clave: el calendario recorre el mes completo, no la serie, así
  // que necesita buscar cada día en vez de iterarla en orden.
  const byKey = useMemo(() => {
    const map = new Map<string, { day: DailySale; index: number }>();
    series.forEach((day, index) => map.set(day.key, { day, index }));
    return map;
  }, [series]);

  const months = useMemo(() => {
    const seen: string[] = [];
    for (const day of series) {
      const month = monthOf(day.key);
      if (seen[seen.length - 1] !== month) seen.push(month);
    }
    return seen;
  }, [series]);

  const [monthKey, setMonthKey] = useState<string | null>(null);

  // Sólo se reposiciona cuando el mes que se estaba mirando desaparece del
  // rango filtrado. Mientras siga disponible, no le pisamos la navegación al
  // usuario. Al entrar, arranca en el mes del día seleccionado —que viene de la
  // curva— y si no, en el más reciente.
  useEffect(() => {
    if (monthKey && months.includes(monthKey)) return;
    const fromSelection = selectedKey ? monthOf(selectedKey) : null;
    setMonthKey(
      fromSelection && months.includes(fromSelection)
        ? fromSelection
        : (months[months.length - 1] ?? null),
    );
  }, [months, monthKey, selectedKey]);

  const withData = useMemo(() => series.filter((day) => day.hasData), [series]);

  if (series.length === 0 || monthKey === null) return null;

  const monthIndex = months.indexOf(monthKey);
  const [year, month] = monthKey.split("-").map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const leadingBlanks = mondayIndex(firstOfMonth);
  const dayCount = daysInMonth(year, month - 1);

  const floor = withData.length > 0 ? Math.min(...withData.map((d) => d.net)) : 0;
  const ceiling = withData.length > 0 ? Math.max(...withData.map((d) => d.net)) : 0;
  const legendFloors = [floor, ...cuts];

  const monthTotal = series
    .filter((day) => monthOf(day.key) === monthKey && day.hasData)
    .reduce((acc, day) => acc + day.net, 0);

  const cellStyle = { width: `${100 / 7}%` as const, aspectRatio: 1, padding: 2 };

  // El mes se arma en filas de siete y después se descartan las semanas que no
  // contienen ningún día del rango. Sin esto, un mes con un solo día de venta
  // —mayo, en el histórico de la 4928— ocupa cinco filas de celdas vacías.
  // Se recortan semanas enteras, nunca celdas sueltas, para que las columnas
  // sigan correspondiendo a los días de la semana.
  const cells: ({ key: string; dayNumber: number } | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: dayCount }, (_, offset) => ({
      key: `${monthKey}-${String(offset + 1).padStart(2, "0")}`,
      dayNumber: offset + 1,
    })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const allWeeks: ((typeof cells)[number])[][] = [];
  for (let start = 0; start < cells.length; start += 7) allWeeks.push(cells.slice(start, start + 7));

  const hasRangeDay = (week: (typeof cells)[number][]) =>
    week.some((cell) => cell !== null && byKey.has(cell.key));
  const firstWeek = allWeeks.findIndex(hasRangeDay);
  const lastWeek = allWeeks.length - 1 - [...allWeeks].reverse().findIndex(hasRangeDay);
  const weeks = firstWeek === -1 ? allWeeks : allWeeks.slice(firstWeek, lastWeek + 1);

  return (
    <View>
      {/* La leyenda lleva los importes reales de cada tramo: sin ellos el color
          no es interpretable y la escala se vuelve una decoración. Los cortes
          son los del rango completo, no los del mes: recalcularlos por mes
          haría que el mismo color significara cosas distintas al pasar de uno
          a otro, y los meses deben poder compararse entre sí. */}
      <View style={{ flexDirection: "row", marginTop: 4 }}>
        {heat.steps.map((color, index) => (
          <View
            key={color}
            style={{
              flex: 1,
              height: 26,
              backgroundColor: color,
              alignItems: "center",
              justifyContent: "center",
              borderTopLeftRadius: index === 0 ? 7 : 0,
              borderBottomLeftRadius: index === 0 ? 7 : 0,
              borderTopRightRadius: index === heat.steps.length - 1 ? 7 : 0,
              borderBottomRightRadius: index === heat.steps.length - 1 ? 7 : 0,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: "700", color: heat.inkFor(index + 1) }}>
              {formatCompactARS(legendFloors[index])}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
        <Text style={{ fontSize: 10, color: palette.subtext }}>{`desde ${formatCompactARS(floor)}`}</Text>
        <Text style={{ fontSize: 10, color: palette.subtext }}>{`hasta ${formatCompactARS(ceiling)}`}</Text>
      </View>

      {/* Un mes por pantalla. Con el rango completo en una sola grilla las
          semanas se encadenan sin corte y deja de leerse como un calendario. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          accessibilityState={{ disabled: monthIndex <= 0 }}
          disabled={monthIndex <= 0}
          onPress={() => setMonthKey(months[monthIndex - 1])}
          hitSlop={8}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.surfaceMuted,
            opacity: monthIndex <= 0 ? 0.35 : 1,
          }}
        >
          <Feather name="chevron-left" size={17} color={palette.text} />
        </Pressable>

        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: palette.text }}>
            {`${MONTHS[month - 1]} ${year}`}
          </Text>
          <Text style={{ fontSize: 10.5, color: palette.subtext, marginTop: 1 }}>
            {months.length > 1
              ? `${formatCompactARS(monthTotal)} · mes ${monthIndex + 1} de ${months.length}`
              : formatCompactARS(monthTotal)}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          accessibilityState={{ disabled: monthIndex >= months.length - 1 }}
          disabled={monthIndex >= months.length - 1}
          onPress={() => setMonthKey(months[monthIndex + 1])}
          hitSlop={8}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.surfaceMuted,
            opacity: monthIndex >= months.length - 1 ? 0.35 : 1,
          }}
        >
          <Feather name="chevron-right" size={17} color={palette.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", marginTop: 12 }}>
        {WEEKDAYS.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", color: palette.subtext }}
          >
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={`week-${weekIndex}`} style={{ flexDirection: "row", marginTop: weekIndex === 0 ? 5 : 0 }}>
          {week.map((cell, columnIndex) => {
            if (cell === null) {
              return <View key={`pad-${weekIndex}-${columnIndex}`} style={cellStyle} />;
            }

            const entry = byKey.get(cell.key);

            // Días del mes que caen fuera del rango filtrado: el mes se dibuja
            // completo para que las columnas sigan siendo días de la semana,
            // pero estos no son fechas «sin datos», simplemente no se pidieron.
            if (!entry) {
              return (
                <View key={cell.key} style={cellStyle}>
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 9, color: palette.subtext, opacity: 0.35 }}>{cell.dayNumber}</Text>
                  </View>
                </View>
              );
            }

            const { day, index } = entry;
            const bucket = day.hasData ? bucketFor(day.net, cuts) : 0;
            const selected = day.key === selectedKey;
            const background = day.hasData ? heat.steps[bucket - 1] : heat.empty;
            const ink = day.hasData ? heat.inkFor(bucket) : palette.subtext;

            return (
              <View key={cell.key} style={cellStyle}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={
                    day.hasData
                      ? `${cell.dayNumber} de ${MONTHS[month - 1]}: ${formatCurrencyARS(day.net)}`
                      : `${cell.dayNumber} de ${MONTHS[month - 1]}: sin datos`
                  }
                  onPress={() => onSelect(index)}
                  style={{
                    flex: 1,
                    borderRadius: 9,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: background,
                    borderWidth: selected ? 2 : day.hasData ? 0 : 1,
                    borderColor: selected ? palette.primary : palette.border,
                  }}
                >
                  <Text style={{ fontSize: 7, color: ink, opacity: 0.72 }}>{cell.dayNumber}</Text>
                  {/* El número siempre visible: el color sirve para escanear,
                      el número es el dato. También cubre daltonismo. */}
                  <Text style={{ fontSize: 9, fontWeight: "700", color: ink }}>
                    {day.hasData ? formatCompactARS(day.net) : "–"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};
