import React from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Button from "./UI/Button";

type FooterSectionProps = {
  isWide: boolean;
};

const FooterChip = ({ label }: { label: string }) => (
  <Pressable
    accessibilityRole="button"
    className="mr-2 mb-2 rounded-full border border-primary-500 px-3 py-1 transition-colors duration-300"
    style={({ pressed, hovered }) => ({
      backgroundColor: pressed || hovered ? "#007bff" : "transparent",
    })}
  >
    {({ pressed, hovered }) => (
      <Text
        className={`text-xs font-medium ${
          pressed || hovered ? "text-white" : ""
        }`}
        style={{ color: pressed || hovered ? "#ffffff" : "#007bff" }}
      >
        {label}
      </Text>
    )}
  </Pressable>
);

const FooterLink = ({ label }: { label: string }) => (
  <Pressable
    accessibilityRole="button"
    className="mb-2 transition-colors duration-300"
    style={({ pressed, hovered }) => ({
      opacity: pressed || hovered ? 0.8 : 1,
    })}
  >
    <Text className="text-sm font-medium text-white">{label}</Text>
  </Pressable>
);

const FooterSection = ({ isWide }: FooterSectionProps) => {
  const categories = ["Musica", "Teatro", "Deportes", "Familia", "Festivales"];
  const menu = ["Ayuda", "Terminos", "Vender eventos"];

  return (
    <View className="mt-12 bg-brand-dark px-6 pb-10 pt-12">
      <View className={isWide ? "flex-row" : ""}>
        <View className={`flex-1 ${isWide ? "pr-6" : "mb-8"}`}>
          <Text className="text-xs font-bold uppercase text-white/70">
            Seguinos
          </Text>
          <View className="mt-4 flex-row">
            {["facebook", "instagram", "twitter", "youtube"].map((icon) => (
              <Pressable
                key={icon}
                accessibilityRole="button"
                className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white transition-colors duration-300"
                style={({ pressed, hovered }) => ({
                  opacity: pressed || hovered ? 0.8 : 1,
                })}
              >
                <Feather
                  name={icon as keyof typeof Feather.glyphMap}
                  size={18}
                  color="#011a34"
                />
              </Pressable>
            ))}
          </View>
        </View>

        <View className={`flex-1 ${isWide ? "pr-6" : "mb-8"}`}>
          <Text className="text-xs font-bold uppercase text-white/70">
            Categorias
          </Text>
          <View className="mt-4 flex-row flex-wrap">
            {categories.map((category) => (
              <FooterChip key={category} label={category} />
            ))}
          </View>
        </View>

        <View className="flex-1">
          <Text className="text-xs font-bold uppercase text-white/70">
            Menu
          </Text>
          <View className="mt-4">
            {menu.map((item) => (
              <FooterLink key={item} label={item} />
            ))}
          </View>
        </View>
      </View>

      <View className="mt-8 flex-row items-center rounded-2xl bg-slate-800 px-4 py-3">
        <Text className="flex-1 text-xs font-medium text-white/80">
          Usamos cookies para mejorar tu experiencia en la plataforma.
        </Text>
        <Button label="Entendido" className="px-4 py-2" />
      </View>
    </View>
  );
};

export default FooterSection;
