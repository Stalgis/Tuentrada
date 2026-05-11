import React from "react";
import { Pressable, type PressableProps, Text, type StyleProp, type ViewStyle } from "react-native";
import { useAppState } from "../../store/appState";
import { getPalette } from "../../lib/theme";
import { radius, spacing, typography } from "../../lib/design";

type ChipProps = Omit<PressableProps, "style"> & {
  label: string;
  selected?: boolean;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
};

const Chip = ({ label, selected = false, size = "md", style, ...rest }: ChipProps) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);

  const paddingVertical = size === "sm" ? spacing.xs + 2 : spacing.sm + 2;
  const paddingHorizontal = size === "sm" ? spacing.md : spacing.base;
  const labelStyle = size === "sm" ? typography.micro : typography.bodyStrong;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        {
          borderRadius: radius.pill,
          borderWidth: 1,
          paddingHorizontal,
          paddingVertical,
          backgroundColor: selected ? palette.primary : palette.surfaceMuted,
          borderColor: selected ? palette.primary : palette.hairline,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={{
          ...labelStyle,
          color: selected ? "#ffffff" : palette.subtext,
          textTransform: "none",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export default Chip;
