import React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useAppState } from "../../store/appState";
import { getPalette } from "../../lib/theme";

export type BarDatum = {
  label: string;
  value: number;
  /** Label shown above the bar when selected */
  valueLabel?: string;
};

export const MiniBarChart = ({
  data,
  highlightIndex,
  selectedIndex,
  onBarPress,
  barAreaHeight = 110,
}: {
  data: BarDatum[];
  highlightIndex?: number;
  selectedIndex?: number;
  onBarPress?: (index: number) => void;
  barAreaHeight?: number;
}) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const max = Math.max(...data.map((d) => d.value), 0);

  return (
    <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
      {data.map((item, index) => {
        const isActive = selectedIndex === index || (selectedIndex == null && highlightIndex === index);
        return (
          <Pressable
            key={`${index}-${item.label}`}
            onPress={() => onBarPress?.(index)}
            style={{ flex: 1, alignItems: "center" }}
          >
            {/* bar area — fixed height so all bars align at bottom */}
            <View style={{ width: "100%", height: barAreaHeight, justifyContent: "flex-end" }}>
              <View
                style={{
                  width: "100%",
                  height: max === 0 || item.value <= 0 ? 4 : Math.max(16, (item.value / max) * barAreaHeight),
                  borderRadius: 12,
                  backgroundColor: isActive ? palette.primary : palette.primarySoft,
                }}
              />
            </View>
            <Text style={{ color: palette.subtext, fontSize: 10, marginTop: 6, textAlign: "center" }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
