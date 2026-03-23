import React from "react";
import { Pressable, Text } from "react-native";
import { useAppState } from "../../store/appState";

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  textClassName?: string;
};

const FilterChip = ({
  label,
  active,
  onPress,
  disabled = false,
  className = "",
  textClassName = "",
}: FilterChipProps) => {
  const { theme } = useAppState();
  const isDark = theme === "dark";

  const containerClass = active
    ? isDark
      ? "border-blue-300/25 bg-blue-400/15"
      : "border-blue-200 bg-blue-50"
    : isDark
      ? "border-white/10 bg-white/[0.03]"
      : "border-border-light bg-card-light";
  const labelClass = active
    ? isDark
      ? "text-blue-100"
      : "text-blue-700"
    : isDark
      ? "text-text-dark"
      : "text-text-light";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`min-h-10 items-center justify-center rounded-[14px] border px-3 py-[9px] ${
        disabled ? "opacity-60" : ""
      } ${containerClass} ${className}`}
    >
      <Text
        numberOfLines={1}
        className={`text-center text-xs font-bold ${labelClass} ${textClassName}`}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export default FilterChip;
