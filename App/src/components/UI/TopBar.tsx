import React from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppState } from "../../store/appState";
import { useAuth } from "../../store/auth";
import Avatar from "../Avatar";

type TopBarProps = {
  title: string;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  rightInitials?: string;
  className?: string;
  leftIcon?: "menu" | "back";
  titleNumberOfLines?: number;
  titleClassName?: string;
};

const TopBar = ({
  title,
  onLeftPress,
  onRightPress,
  rightInitials,
  className = "",
  leftIcon = "menu",
  titleNumberOfLines = 1,
  titleClassName = "",
}: TopBarProps) => {
  const { theme } = useAppState();
  const { user } = useAuth();
  const isDark = theme === "dark";

  const leftButtonClass = isDark
    ? "rounded-full border border-white/10 bg-white/5 p-1.5"
    : "rounded-full border border-slate-200 bg-slate-100/70 p-1.5";
  const leftIconColor = isDark ? "#cbd5e1" : "#475569";
  const avatarClass = isDark
    ? "bg-white/5 border border-white/10"
    : "bg-slate-100/75 border border-slate-200";
  const avatarTextClass = isDark ? "text-[10px] text-slate-300" : "text-[10px] text-slate-600";

  return (
    <View
      className={`flex flex-row items-center border-b px-5 pt-3 pb-2 ${
        isDark
          ? "border-border-dark bg-background-dark"
          : "border-border-light bg-background-light"
      } ${className}`}
    >
      <Pressable
        onPress={onLeftPress}
        hitSlop={8}
        disabled={!onLeftPress}
        accessibilityRole="button"
        accessibilityLabel={leftIcon === "back" ? "Volver" : "Abrir menu"}
        accessibilityState={{ disabled: !onLeftPress }}
        className={`mr-3 ${leftButtonClass} ${!onLeftPress ? "opacity-60" : ""}`}
      >
        <Feather
          name={leftIcon === "back" ? "arrow-left" : "menu"}
          size={18}
          color={leftIconColor}
        />
      </Pressable>

      <View className="flex-1">
        <Text
          numberOfLines={titleNumberOfLines}
          className={`text-[1.75rem] font-bold tracking-tight ${
            isDark ? "text-text-dark" : "text-text-light"
          } ${titleClassName}`}
        >
          {title}
        </Text>
      </View>

      <Avatar
        initials={rightInitials ?? user?.initials ?? "TU"}
        size="sm"
        className={avatarClass}
        textClassName={avatarTextClass}
        onPress={onRightPress}
        hitSlop={8}
      />
    </View>
  );
};

export default TopBar;
