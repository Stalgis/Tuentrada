import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { radius, shadow } from "../../lib/design";
import { getPalette } from "../../lib/theme";
import { useAppState } from "../../store/appState";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const ACTION_OFFSET = 68;

type AgentFloatingButtonProps = {
  bottom: number;
  onOpenAgent: () => void;
};

const AgentFloatingButton = ({ bottom, onOpenAgent }: AgentFloatingButtonProps) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  // El feedback de presionado va por Reanimated, no por el `style` como
  // función de Pressable: ver el comentario en `mainStyle`.
  const pressed = useSharedValue(0);
  const [expanded, setExpanded] = useState(false);

  const animateTo = (next: boolean) => {
    setExpanded(next);
    progress.value = reduceMotion
      ? Number(next)
      : withSpring(Number(next), {
          duration: 280,
          dampingRatio: 0.82,
          overshootClamping: true,
        });
  };

  const toggle = () => animateTo(!expanded);

  const openAgent = () => {
    animateTo(false);
    onOpenAgent();
  };

  const actionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: -ACTION_OFFSET * progress.value },
      { scale: interpolate(progress.value, [0, 1], [0.82, 1]) },
    ],
  }));

  /**
   * Escala y opacidad al presionar.
   *
   * Antes esto se resolvía con `style={({ pressed }) => [...]}`, que es la
   * forma nativa de Pressable pero NO sobrevive a
   * `Animated.createAnimatedComponent`: Reanimated pasa el style por
   * `flattenArray`, que convierte la función en `[fn]`. Pressable sólo llama a
   * la función cuando el style ES una función, no cuando es un array que la
   * contiene, así que la función nunca se ejecutaba y el botón se quedaba sin
   * ancho, sin alto y sin color de fondo. Es decir: invisible.
   */
  const mainStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0.86]),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.94]) }],
  }));

  const plusStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg`,
      },
    ],
  }));

  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom }]}>
      <AnimatedPressable
        pointerEvents={expanded ? "auto" : "none"}
        disabled={!expanded}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "yes" : "no-hide-descendants"}
        onPress={openAgent}
        accessibilityRole="button"
        accessibilityLabel="Abrir agente"
        accessibilityHint="Abre el chat para consultar datos de tus eventos"
        style={[
          styles.action,
          shadow.elevated,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
          actionStyle,
        ]}
      >
        <View style={[styles.actionIcon, { backgroundColor: palette.surfaceEmphasis }]}>
          <Feather name="message-circle" size={18} color={palette.primary} />
        </View>
        <Text style={[styles.actionLabel, { color: palette.text }]}>Agente</Text>
      </AnimatedPressable>

      <AnimatedPressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Cerrar acceso al agente" : "Abrir acceso al agente"}
        accessibilityState={{ expanded }}
        hitSlop={8}
        onPressIn={() => {
          pressed.value = reduceMotion ? 1 : withSpring(1, { duration: 120, dampingRatio: 1 });
        }}
        onPressOut={() => {
          pressed.value = reduceMotion ? 0 : withSpring(0, { duration: 160, dampingRatio: 1 });
        }}
        style={[
          styles.mainButton,
          shadow.elevated,
          { backgroundColor: palette.primary },
          mainStyle,
        ]}
      >
        <Animated.View style={plusStyle}>
          <Feather name="plus" size={26} color={palette.onPrimary} />
        </Animated.View>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 20,
    width: 124,
    height: 56,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    zIndex: 20,
    elevation: 20,
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    position: "absolute",
    right: 0,
    bottom: 0,
    minWidth: 118,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    marginLeft: 9,
    marginRight: 9,
    fontSize: 14,
    fontWeight: "800",
  },
});

export default AgentFloatingButton;
