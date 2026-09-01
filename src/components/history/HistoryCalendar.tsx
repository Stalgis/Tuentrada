import React from "react";
import { Pressable, Text, View } from "react-native";
import { useAppState } from "../../store/appState";
import { getPalette } from "../../lib/theme";
import { formatCompactARS, formatCurrencyARS } from "../../lib/formatters";
import { bucketFor, type DailySale } from "../../lib/salesHistory";
import { getHeatScale } from "./heatColors";

// La semana arranca el lunes, como el resto de la app y como la web.
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;

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

  if (series.length === 0) return null;

  const leadingBlanks = mondayIndex(series[0].date);
  const withData = series.filter((day) => day.hasData);
  const floor = withData.length > 0 ? Math.min(...withData.map((d) => d.net)) : 0;
  const ceiling = withData.length > 0 ? Math.max(...withData.map((d) => d.net)) : 0;
  const legendFloors = [floor, ...cuts];

  return (
    <View>
      {/* La leyenda lleva los importes reales de cada tramo: sin ellos el color
          no es interpretable y la escala se vuelve una decoración. */}
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

      <View style={{ flexDirection: "row", marginTop: 14 }}>
        {WEEKDAYS.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", color: palette.subtext }}
          >
            {label}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 5 }}>
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }} />
        ))}

        {series.map((day, index) => {
          const bucket = day.hasData ? bucketFor(day.net, cuts) : 0;
          const selected = day.key === selectedKey;
          const background = day.hasData ? heat.steps[bucket - 1] : heat.empty;
          const ink = day.hasData ? heat.inkFor(bucket) : palette.subtext;

          return (
            <View key={day.key} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  day.hasData
                    ? `${day.date.getDate()}: ${formatCurrencyARS(day.net)}`
                    : `${day.date.getDate()}: sin datos`
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
                <Text style={{ fontSize: 9, color: ink, opacity: 0.72 }}>{day.date.getDate()}</Text>
                {/* El número siempre visible: el color sirve para escanear, el
                    número es el dato. También cubre daltonismo. */}
                <Text style={{ fontSize: 11, fontWeight: "700", color: ink }}>
                  {day.hasData ? formatCompactARS(day.net) : "–"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
};
