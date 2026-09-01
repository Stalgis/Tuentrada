import React, { useCallback, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useAppState } from "../../store/appState";
import { getPalette } from "../../lib/theme";
import { barScaleCutoff, type DailySale } from "../../lib/salesHistory";

type ScrubProps = {
  count: number;
  onSelect: (index: number) => void;
  children: React.ReactNode;
};

/**
 * Arrastrar sobre el gráfico selecciona el día bajo el dedo. En móvil un
 * tooltip flotante queda tapado por la mano, así que el detalle vive en una
 * tarjeta aparte y esto sólo mueve el índice.
 */
const Scrubbable = ({ count, onSelect, children }: ScrubProps) => {
  const [width, setWidth] = useState(0);

  const pick = useCallback(
    (x: number) => {
      if (width <= 0 || count <= 0) return;
      const index = Math.round((x / width) * count - 0.5);
      onSelect(Math.max(0, Math.min(count - 1, index)));
    },
    [count, onSelect, width],
  );

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
      onResponderMove={(e) => pick(e.nativeEvent.locationX)}
    >
      {children}
    </View>
  );
};

/** Rectángulo con las esquinas superiores redondeadas, anclado a la base. */
const barPath = (x: number, y: number, w: number, h: number, r: number): string => {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  return (
    `M${x} ${y + h}V${y + radius}` +
    `a${radius} ${radius} 0 0 1 ${radius} ${-radius}` +
    `h${w - 2 * radius}` +
    `a${radius} ${radius} 0 0 1 ${radius} ${radius}` +
    `V${y + h}Z`
  );
};

const VIEW_W = 320;

export const CumulativeChart = ({
  values,
  selectedIndex,
  capacity,
  onSelect,
  formatValue,
}: {
  values: number[];
  selectedIndex: number;
  capacity?: number;
  onSelect: (index: number) => void;
  formatValue: (value: number) => string;
}) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const height = 132;
  const top = 12;
  const bottom = 118;

  if (values.length === 0) return null;

  const last = values[values.length - 1];
  const ceiling = Math.max(capacity ?? 0, last, 1);
  const y = (value: number) => bottom - (value / ceiling) * (bottom - top);
  const x = (index: number) => ((index + 0.5) / values.length) * VIEW_W;

  // El primer punto se ancla en cero: sin él la curva arranca ya alta y el
  // salto del día de salida a la venta —lo más característico de la serie—
  // queda fuera del gráfico.
  const points: [number, number][] = [[0, y(0)], ...values.map((v, i): [number, number] => [x(i), y(v)])];
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${bottom} L0 ${bottom}Z`;

  const sx = x(selectedIndex);
  const sy = y(values[selectedIndex]);
  const capY = capacity ? y(capacity) : null;

  return (
    <Scrubbable count={values.length} onSelect={onSelect}>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_W} ${height}`}>
        <Defs>
          <LinearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.primary} stopOpacity={0.26} />
            <Stop offset="1" stopColor={palette.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Line x1={0} y1={bottom} x2={VIEW_W} y2={bottom} stroke={palette.hairline} strokeWidth={1} />

        {capY != null ? (
          <>
            <Line
              x1={0}
              y1={capY}
              x2={VIEW_W}
              y2={capY}
              stroke={palette.subtext}
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.55}
            />
            <SvgText x={VIEW_W} y={capY - 5} textAnchor="end" fontSize={9.5} fontWeight="600" fill={palette.subtext}>
              {`Aforo ${formatValue(capacity as number)}`}
            </SvgText>
          </>
        ) : null}

        <Path d={area} fill="url(#cumFill)" />
        <Path d={line} fill="none" stroke={palette.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <Line x1={sx} y1={top - 6} x2={sx} y2={bottom} stroke={palette.primary} strokeWidth={1} opacity={0.38} />
        <Circle cx={sx} cy={sy} r={5} fill={palette.primary} stroke={palette.surface} strokeWidth={2} />
        <SvgText
          x={Math.min(VIEW_W - 2, Math.max(28, sx))}
          y={Math.max(11, sy - 12)}
          textAnchor={sx > VIEW_W - 70 ? "end" : sx < 40 ? "start" : "middle"}
          fontSize={11}
          fontWeight="700"
          fill={palette.text}
        >
          {formatValue(values[selectedIndex])}
        </SvgText>
      </Svg>
    </Scrubbable>
  );
};

export const DailyBars = ({
  series,
  valueOf,
  selectedIndex,
  onSelect,
  formatValue,
}: {
  series: DailySale[];
  valueOf: (day: DailySale) => number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatValue: (value: number) => string;
}) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const height = 92;
  const top = 18;
  const bottom = 84;

  if (series.length === 0) return null;

  // El día de salida a la venta multiplica por cien a un día normal. Con escala
  // completa el resto de las barras queda en un pixel —el mismo problema que
  // hace ilegible un calendario lineal—, así que se corta la escala y las
  // barras que la superan se marcan y se rotulan con su valor real.
  const cutoff = Math.max(1, barScaleCutoff(series.filter((d) => d.hasData).map(valueOf), 0.95));
  const width = Math.max(3, VIEW_W / series.length - 2.4);
  const x = (index: number) => ((index + 0.5) / series.length) * VIEW_W;

  return (
    <Scrubbable count={series.length} onSelect={onSelect}>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_W} ${height}`}>
        {series.map((day, index) => {
          const left = x(index) - width / 2;

          if (!day.hasData) {
            // Hueco explícito: ni barra en cero (que sería una venta nula que
            // no ocurrió) ni columna omitida (que rompería el eje).
            return (
              <Rect
                key={day.key}
                x={left}
                y={bottom - 3}
                width={width}
                height={3}
                fill={palette.subtext}
                opacity={0.28}
              />
            );
          }

          const value = valueOf(day);
          const over = value > cutoff;
          const barHeight = Math.max(1.5, Math.min(1, value / cutoff) * (bottom - top));
          const selected = index === selectedIndex;

          return (
            <React.Fragment key={day.key}>
              <Path
                d={barPath(left, bottom - barHeight, width, barHeight, 4)}
                fill={palette.primary}
                opacity={selected ? 1 : 0.42}
                stroke={selected ? palette.surface : undefined}
                strokeWidth={selected ? 2 : 0}
              />
              {over ? (
                <>
                  <Line
                    x1={left - 1.5}
                    y1={top + 9}
                    x2={left + width + 1.5}
                    y2={top + 4}
                    stroke={palette.surface}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                  />
                  <Line
                    x1={left - 1.5}
                    y1={top + 5}
                    x2={left + width + 1.5}
                    y2={top}
                    stroke={palette.surface}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                  />
                  <SvgText x={Math.max(0, left - 2)} y={top - 6} fontSize={9.5} fontWeight="700" fill={palette.text}>
                    {formatValue(value)}
                  </SvgText>
                </>
              ) : null}
            </React.Fragment>
          );
        })}
        <Line x1={0} y1={bottom} x2={VIEW_W} y2={bottom} stroke={palette.hairline} strokeWidth={1} />
      </Svg>
    </Scrubbable>
  );
};
