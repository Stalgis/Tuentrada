import React from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TuEntradaHeaderProps = {
  compact?: boolean;
  onEticketPress?: () => void;
  onFaqPress?: () => void;
  onHelpPress?: () => void;
  onLanguagePress?: () => void;
};

const TuEntradaHeader = ({
  compact = false,
  onEticketPress,
  onFaqPress,
  onHelpPress,
  onLanguagePress,
}: TuEntradaHeaderProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-brand-dark border-b border-brand-darkAlt"
    >
      <View className="flex-row items-center px-5 py-3">
        <View className="flex-1 flex-row items-center">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <Text className="text-sm font-bold text-white">TE</Text>
          </View>
          {!compact ? (
            <Text className="ml-2 text-lg font-bold text-white">
              TuEntrada
            </Text>
          ) : null}
        </View>

        <View className="flex-1 items-center">
          <Pressable
            accessibilityRole="button"
            onPress={onEticketPress}
            className="flex-row items-center rounded-full px-4 py-2 transition-colors duration-300"
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed || hovered ? "#0066cc" : "#007bff",
            })}
          >
            <Feather name="download" size={16} color="#fff" />
            {!compact ? (
              <Text className="ml-2 text-xs font-medium uppercase text-white">
                Descarga tu eticket
              </Text>
            ) : null}
          </Pressable>
        </View>

        <View className="flex-1 flex-row items-center justify-end">
          <Pressable
            accessibilityRole="button"
            onPress={onFaqPress}
            className="mr-3 flex-row items-center rounded-full px-2 py-1 transition-colors duration-300"
            style={({ pressed, hovered }) => ({
              backgroundColor:
                pressed || hovered ? "rgba(255,255,255,0.15)" : "transparent",
            })}
          >
            <Feather name="info" size={16} color="#fff" />
            {!compact ? (
              <Text className="ml-1 text-xs font-medium text-white">
                FAQ
              </Text>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onHelpPress}
            className="mr-3 flex-row items-center rounded-full px-2 py-1 transition-colors duration-300"
            style={({ pressed, hovered }) => ({
              backgroundColor:
                pressed || hovered ? "rgba(255,255,255,0.15)" : "transparent",
            })}
          >
            <Feather name="help-circle" size={16} color="#fff" />
            {!compact ? (
              <Text className="ml-1 text-xs font-medium text-white">
                Ayuda
              </Text>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onLanguagePress}
            className="flex-row items-center rounded-full px-2 py-1 transition-colors duration-300"
            style={({ pressed, hovered }) => ({
              backgroundColor:
                pressed || hovered ? "rgba(255,255,255,0.15)" : "transparent",
            })}
          >
            <Feather name="globe" size={16} color="#fff" />
            {!compact ? (
              <Text className="ml-1 text-xs font-medium text-white">
                ES
              </Text>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default TuEntradaHeader;
