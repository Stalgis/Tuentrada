import React from "react";
import { Text, View } from "react-native";
import { useAppState } from "../../store/appState";
import Avatar from "../Avatar";
import { useAuth } from "@/store/auth";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  leftAccessory?: React.ReactNode;
  compact?: boolean;
  avatarSize?: "sm" | "md" | "lg";
  avatarClassName?: string;
  avatarTextClassName?: string;
};

const PageHeader = ({
  title,
  subtitle,
  leftAccessory,
  compact = false,
  avatarSize = "md",
  avatarClassName,
  avatarTextClassName,
}: PageHeaderProps) => {
  const { theme } = useAppState();
  const isDark = theme === "dark";
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const handleAvatarPress = () => {
    const parentNav = navigation.getParent?.();
    const target = parentNav ?? navigation;
    target.navigate("Profile");
  };

  return (
    <View
      className={`px-5 border-b flex flex-row items-center ${
        compact ? "pt-3 pb-2" : "pt-4 pb-3"
      } ${
        isDark
          ? "bg-background-dark border-border-dark"
          : "bg-background-light border-border-light"
      }`}
    >
      {leftAccessory ? <View className="mr-3">{leftAccessory}</View> : null}
      <View className="flex-1">
        <Text
          className={`font-bold tracking-tight ${
            compact ? "text-[1.75rem]" : "text-3xl"
          } ${
            isDark ? "text-text-dark" : "text-text-light"
          }`}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className={`mt-1 text-base ${
              isDark ? "text-subtext-dark" : "text-subtext-light"
            }`}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Avatar
        initials={user?.initials ?? "TU"}
        size={avatarSize}
        className={avatarClassName}
        textClassName={avatarTextClassName}
        onPress={handleAvatarPress}
        hitSlop={8}
      />
    </View>
  );
};

export default PageHeader;
