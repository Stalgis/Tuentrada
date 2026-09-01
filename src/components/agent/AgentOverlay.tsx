import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AgentConversation from "./AgentConversation";
import { newConversationId } from "../../lib/agentConversation";
import { radius } from "../../lib/design";
import { getPalette } from "../../lib/theme";
import { useAppState } from "../../store/appState";
import { useAuth } from "../../store/auth";

/** Alto de la franja que deja ver el dashboard atenuado, debajo del área segura. */
const STRIP_HEIGHT = 56;

/** Diámetro del botón flotante. Se usa para calcular cuánto aire dejarle. */
const BUTTON_SIZE = 56;

/**
 * Entrar con calma y salir rápido: 220 sobre 340 es el 65%, dentro del rango
 * que recomienda Material. Una salida lenta se siente como que la interfaz
 * tarda en obedecer.
 */
const ENTER_MS = 340;
const EXIT_MS = 220;

type AgentOverlayProps = {
  open: boolean;
  onClose: () => void;
  /** Dónde vive el botón flotante, para que no tape los últimos mensajes. */
  buttonBottom: number;
};

/**
 * El agente como capa sobre la pantalla actual.
 *
 * Vive al lado del Tab.Navigator, no dentro de una ruta, así que **nunca se
 * desmonta**. Esa es toda la gracia: los mensajes en pantalla y el hilo del
 * servidor sobreviven al cierre, y la memoria de 30 minutos que guarda el
 * servicio empieza a valer. Como pantalla, cada entrada creaba un hilo nuevo y
 * el agente no se acordaba de nada.
 *
 * Cerrada se desplaza fuera de la pantalla en vez de dejar de renderizarse:
 * desmontarla cortaría la animación de salida a la mitad y borraría los
 * mensajes.
 */
const AgentOverlay = ({ open, onClose, buttonBottom }: AgentOverlayProps) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { theme } = useAppState();
  const { sessionGeneration } = useAuth();
  const palette = getPalette(theme);
  const reduceMotion = useReducedMotion();
  const [conversationId, setConversationId] = useState(newConversationId);
  const progress = useSharedValue(open ? 1 : 0);
  // El efecto de abajo corre también en el montaje, cuando la capa nunca
  // estuvo abierta. Sin esta guarda, arrancar la app cerraría un teclado que
  // podría estar levantado en otra pantalla.
  const seAbrioAlgunaVez = useRef(open);

  useEffect(() => {
    if (open) {
      seAbrioAlgunaVez.current = true;
      progress.value = reduceMotion
        ? 1
        : withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
      return;
    }

    // Si el teclado quedó abierto, se va con la capa: dejarlo levantado sobre
    // el dashboard se ve como un error.
    if (seAbrioAlgunaVez.current) Keyboard.dismiss();
    progress.value = reduceMotion
      ? 0
      : withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
  }, [open, progress, reduceMotion]);

  /**
   * Una conversación por sesión: no hay forma de reiniciar el hilo a mano. Se
   * corta solo al cerrar sesión, o del lado del servidor tras 30 minutos sin
   * actividad. Es una decisión de producto, no un pendiente.
   *
   * Lo que hace útil a esta capa (que nada se destruya) es también su único
   * riesgo: si cambiara de usuario sin desmontarse, el segundo vería los
   * mensajes del primero.
   *
   * El servidor está a salvo porque indexa por fingerprint del token, pero el
   * array local de mensajes no. Atarse a `sessionGeneration` cierra la duda:
   * el hilo nuevo corta el historial del servidor, y la `key` en
   * `AgentConversation` fuerza un remontaje que vacía los mensajes en pantalla.
   */
  useEffect(() => {
    setConversationId(newConversationId());
  }, [sessionGeneration]);

  /**
   * Como ruta, el botón atrás de Android funcionaba gratis. Como capa hay que
   * consumirlo a mano: sin esto el back saca de la app en vez de cerrar el chat.
   */
  useEffect(() => {
    if (!open) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [open, onClose]);

  // El scrim aparece y desaparece por opacidad. Deslizarlo junto con la hoja
  // se vería como una cortina que baja, no como el fondo atenuándose.
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  /**
   * La hoja se desplaza su propio alto, no el de la pantalla.
   *
   * Con el alto completo, el primer tramo del recorrido pasaba por debajo del
   * borde inferior: la hoja se movía sin que se viera nada, y en ese hueco lo
   * único perceptible era el fondo oscureciéndose. Parecía que la sombra
   * llegaba antes que el chat. Desplazando exactamente su alto, cada cuadro
   * del movimiento es visible.
   */
  const sheetHeight = Math.max(1, height - insets.top - STRIP_HEIGHT);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight }],
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      // Cerrada la capa sigue montada pero no debe recibir toques ni ser
      // leída: sin esto el dashboard quedaría tapado por una capa invisible.
      pointerEvents={open ? "auto" : "none"}
      accessibilityViewIsModal={open}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "yes" : "no-hide-descendants"}
      accessibilityLabel="Agente"
    >
      {/* El atenuado cubre toda la pantalla, no sólo la franja de arriba.
          Acotado a la franja, mientras la hoja subía se oscurecía una banda
          superior y el medio quedaba sin atenuar: se leía como un error, no
          como una capa que aparece. Debajo de la franja lo tapa la hoja. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(0,0,0,0.5)" },
          scrimStyle,
        ]}
      />

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cerrar el agente"
        style={{ height: insets.top + STRIP_HEIGHT }}
      />

      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: palette.background,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            overflow: "hidden",
            paddingBottom: insets.bottom,
          },
          sheetStyle,
        ]}
      >
        <AgentConversation
          key={sessionGeneration}
          conversationId={conversationId}
          // El botón queda flotando sobre la conversación: sin este aire, el
          // último mensaje se lee por debajo del círculo.
          scrollBottomInset={Math.max(0, buttonBottom + BUTTON_SIZE - insets.bottom)}
        />
      </Animated.View>
    </View>
  );
};

export default AgentOverlay;
