import React from "react";
import { Text, View } from "react-native";
import { useAppState } from "../../store/appState";
import Avatar from "../Avatar";
import { useAuth } from "@/store/auth";
import { useNavigation } from "@react-navigation/native";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  leftAccessory?: React.ReactNode;
};

const PageHeader = ({ title, subtitle, leftAccessory }: PageHeaderProps) => {
  const { theme } = useAppState();
  const isDark = theme === "dark";
  const { user } = useAuth();
  const navigation = useNavigation();

  return (
    <View
      className={`px-5 pt-4 pb-3 border-b flex flex-row items-center ${
        isDark
          ? "bg-background-dark border-border-dark"
          : "bg-background-light border-border-light"
      }`}
    >
      {leftAccessory ? <View className="mr-3">{leftAccessory}</View> : null}
      <View className="flex-1">
        <Text
          className={`text-3xl font-bold ${
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
        size="md"
        onPress={() => navigation.navigate("Profile")}
      />
    </View>
  );
};

export default PageHeader;
