import React from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export type HeroSlide = {
  title: string;
  subtitle: string;
  highlight: string;
};

type HeroBannerProps = {
  slide: HeroSlide;
  totalSlides: number;
  activeIndex: number;
};

const HeroBanner = ({ slide, totalSlides, activeIndex }: HeroBannerProps) => (
  <View className="rounded-b-3xl overflow-hidden">
    <LinearGradient colors={["#011a34", "#042450"]}>
      <View className="relative px-6 pt-14 pb-10 items-center">
        <View className="absolute -top-8 -right-10 h-32 w-32 rounded-full bg-white/5" />
        <View className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-primary-500/15" />
        <Text className="text-xs font-medium uppercase tracking-widest text-white/70">
          TuEntrada
        </Text>
        <Text className="mt-3 text-center text-4xl font-bold uppercase text-white">
          {slide.title}
        </Text>
        <Text className="mt-3 text-center text-sm font-bold uppercase text-brand-danger">
          {slide.highlight}
        </Text>
        <Text className="mt-1 text-center text-sm font-light text-white/90">
          {slide.subtitle}
        </Text>
      </View>

      <View className="flex-row justify-center pb-4">
        {Array.from({ length: totalSlides }).map((_, index) => (
          <View
            key={`hero-indicator-${index}`}
            className={`mx-1 h-1.5 w-8 rounded-full ${
              index === activeIndex ? "bg-primary-500" : "bg-white/40"
            }`}
          />
        ))}
      </View>
    </LinearGradient>
  </View>
);

export default HeroBanner;
