import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { radius, shadow } from "../../lib/design";
import { getPalette } from "../../lib/theme";
import { useAppState } from "../../store/appState";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SIZE = 56;
const ICON_MS = 200;

type AgentFloatingButtonProps = {
  open: boolean;
  onToggle: () => void;
  bottom: number;
};

/**
 * Un único botón que abre y cierra el agente.
 *
 * No se mueve: sólo cambia el ícono. Moverlo a la esquina de arriba se probó y
 * el desplazamiento se leía brusco; además el choque que se temía con el botón
 * de enviar del composer no existe, porque el flotante queda unos 30pt por
 * encima. Quieto es más tranquilo y no pierde nada.
 */
const AgentFloatingButton = ({ open, onToggle, bottom }: AgentFloatingButtonProps) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const reduceMotion = useReducedMotion();

  const progress = useSharedValue(open ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    const destino = open ? 1 : 0;
    progress.value = reduceMotion
      ? destino
      : withTiming(destino, { duration: ICON_MS, easing: Easing.out(Easing.quad) });
  }, [open, progress, reduceMotion]);

  /**
   * El feedback de presionado va por Reanimated y no por el `style` como
   * función de Pressable: `createAnimatedComponent` pasa el style por
   * `flattenArray`, que convierte la función en `[fn]`. Pressable sólo la
   * ejecuta cuando el style ES una función, no cuando es un array que la
   * contiene, así que el botón se quedaba sin ancho, sin alto y sin color.
   */
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0.86]),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.94]) }],
  }));

  /**
   * Los dos íconos viven apilados y se cruzan con un giro corto de 45° y una
   * escala leve. Un swap seco delataría que son dos elementos distintos; un
   * giro completo sería más movimiento del que amerita cambiar un ícono.
   */
  const chatStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.55], [1, 0]),
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, -45])}deg` },
      { scale: interpolate(progress.value, [0, 1], [1, 0.7]) },
    ],
  }));

  const closeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.45, 1], [0, 1]),
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [45, 0])}deg` },
      { scale: interpolate(progress.value, [0, 1], [0.7, 1]) },
    ],
  }));

  const setPressed = (value: number) => {
    pressed.value = reduceMotion ? value : withTiming(value, { duration: 120 });
  };

  return (
    <AnimatedPressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={open ? "Cerrar el agente" : "Abrir el agente"}
      accessibilityState={{ expanded: open }}
      hitSlop={8}
      onPressIn={() => setPressed(1)}
      onPressOut={() => setPressed(0)}
      style={[
        styles.button,
        shadow.elevated,
        { bottom, backgroundColor: palette.primary },
        buttonStyle,
      ]}
    >
      <View style={styles.iconStack}>
        <Animated.View style={[styles.icon, chatStyle]}>
          <Feather name="message-circle" size={26} color={palette.onPrimary} />
        </Animated.View>
        <Animated.View style={[styles.icon, closeStyle]}>
          <Feather name="x" size={26} color={palette.onPrimary} />
        </Animated.View>
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 20,
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
    elevation: 30,
  },
  iconStack: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AgentFloatingButton;
