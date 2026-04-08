import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useAppState } from "../../store/appState";
import { getPalette } from "../../lib/theme";

export type BarDatum = {
  label: string;
  value: number;
};

export const MiniBarChart = ({ data, highlightIndex }: { data: BarDatum[]; highlightIndex?: number }) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 10 }}>
      {data.map((item, index) => (
        <View key={item.label} style={{ alignItems: "center", flex: 1 }}>
          <View
            style={{
              width: "100%",
              height: Math.max(18, (item.value / max) * 96),
              borderRadius: 14,
              backgroundColor:
                highlightIndex === index
                  ? palette.primary
                  : theme === "dark"
                    ? palette.surfaceMuted
                    : palette.primarySoft,
            }}
          />
          <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 8 }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
};

export const Sparkline = ({ data }: { data: number[] }) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const width = 220;
  const height = 76;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);

  const path = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <Svg width={width} height={height}>
      <Path d={path} stroke={palette.primary} strokeWidth={3} fill="none" />
    </Svg>
  );
};

export const ProgressRing = ({
  value,
  size = 64,
  tone = "primary",
}: {
  value: number;
  size?: number;
  tone?: "primary" | "secondary" | "warning" | "success";
}) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(value, 100) / 100) * circumference;
  const stroke =
    tone === "warning"
      ? palette.warning
      : tone === "secondary"
        ? palette.secondary
        : tone === "success"
          ? palette.success
          : palette.primary;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme === "dark" ? palette.surfaceMuted : palette.border}
          strokeWidth={8}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text
        style={{
          position: "absolute",
          color: palette.text,
          fontSize: 13,
          fontWeight: "800",
        }}
      >
        {Math.round(value)}%
      </Text>
    </View>
  );
};
