import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import AgentMarkdown from "./AgentMarkdown";
import SurfaceCard from "../stitch/SurfaceCard";
import { newConversationId } from "../../lib/agentConversation";
import { AgentApiError, askAgent } from "../../lib/agentApi";
import { layout, radius, spacing, typography } from "../../lib/design";
import { getPalette } from "../../lib/theme";
import { useAppState } from "../../store/appState";
import { useAuth } from "../../store/auth";

type ChatMessage = {
  id: number;
  role: "user" | "assistant" | "system";
  text: string;
  tone?: "error";
  requestId?: string;
};

/**
 * El texto del chat es contenido de lectura, no una etiqueta de dashboard.
 * `typography.body` son 13px sin interlineado definido, y el input del propio
 * composer ya estaba en 15: se leía más chico el mensaje recibido que el que
 * uno escribe. 15/22 alinea los dos y da un interlineado de 1,46 para leer
 * párrafos con cifras.
 */
const mensajeTexto = {
  fontSize: 15,
  lineHeight: 22,
  fontWeight: "400",
} as const;

const SALUDO: ChatMessage = {
  id: 1,
  role: "assistant",
  text: "Usa tus datos reales. Puedo contar y buscar eventos, decirte cuánto vendiste, cómo viene la semana, con qué medios te pagan y cuántas entradas quedan. Todavía no puedo rankear eventos entre sí.",
};

const suggestions = [
  "¿Cuánto vendí este mes?",
  "¿Cómo vengo comparado con el mes pasado?",
  "¿Qué eventos tengo esta semana?",
];


/** Ambos controles del composer miden lo mismo, así enviar y detener no
 * cambian el ancho de la fila: intercambiarlos no mueve el input. */
const COMPOSER_CONTROL = 46;

type ComposerButtonProps = {
  onPress: () => void;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  /** Color del acento: primary para enviar, danger para detener. */
  accent: string;
  onAccent: string;
  mutedSurface: string;
  disabled?: boolean;
  /** `solid` para la acción primaria disponible; `outline` para el resto. */
  variant?: "solid" | "outline";
};

/**
 * Botón circular del composer.
 *
 * El diseño anterior pintaba el estado deshabilitado con `surfaceMuted`
 * (#f2f4f6) sobre el fondo del composer (#f7f9fb): 1,04:1 de contraste, o sea
 * que la forma del botón no existía y sólo flotaban el ícono y la palabra.
 *
 * Acá deshabilitado es CONTORNO y habilitado es RELLENO, en vez de bajar la
 * opacidad. Medido: con opacidad 0,35 la forma quedaba en 1,76:1, por debajo
 * del 3:1 que WCAG 1.4.11 pide para el borde de un control; con contorno el
 * borde da 6,37:1 en claro y 5,87:1 en oscuro. Se ve siempre, y el paso de
 * contorno a relleno mientras escribís avisa que ya se puede enviar.
 */
const ComposerButton = ({
  onPress,
  label,
  icon,
  accent,
  onAccent,
  mutedSurface,
  disabled = false,
  variant = "solid",
}: ComposerButtonProps) => {
  const solido = variant === "solid" && !disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        width: COMPOSER_CONTROL,
        height: COMPOSER_CONTROL,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: solido ? accent : mutedSurface,
        borderWidth: solido ? 1 : 1.5,
        borderColor: accent,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Feather name={icon} size={20} color={solido ? onAccent : accent} />
    </Pressable>
  );
};

type AgentConversationProps = {
  /**
   * Quién es el dueño del hilo.
   *
   * Como pantalla lo genera este componente y muere con el montaje. Como capa
   * flotante lo provee la capa, que no se desmonta: ahí es donde la memoria de
   * 30 minutos del servidor empieza a valer.
   */
  conversationId?: string;
  /**
   * Aire extra al final de la lista. Como capa, el botón flotante queda por
   * encima de la conversación y sin esto taparía el último mensaje. Como
   * pantalla no hay botón encima, así que vale 0.
   */
  scrollBottomInset?: number;
};

const AgentConversation = ({
  conversationId,
  scrollBottomInset = 0,
}: AgentConversationProps) => {
  const { theme } = useAppState();
  const { accessToken } = useAuth();
  const palette = getPalette(theme);
  const scrollRef = useRef<ScrollView>(null);
  const requestRef = useRef<AbortController | null>(null);
  const nextIdRef = useRef(2);
  const ownConversationIdRef = useRef(newConversationId());
  const activeConversationId = conversationId ?? ownConversationIdRef.current;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const signedIn = Boolean(accessToken);
  const canSend = Boolean(input.trim()) && !loading && signedIn;
  const [messages, setMessages] = useState<ChatMessage[]>([SALUDO]);
  // Sólo está el saludo: todavía no hay conversación.
  const esEstadoInicial = messages.length === 1;

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  const appendMessage = (message: Omit<ChatMessage, "id">) => {
    const id = nextIdRef.current++;
    setMessages((current) => [...current, { ...message, id }]);
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
  };

  const cancel = () => {
    requestRef.current?.abort();
  };

  const send = async (suggestedMessage?: string) => {
    const message = (suggestedMessage ?? input).trim();
    if (!message || loading || !accessToken) return;

    setInput("");
    appendMessage({ role: "user", text: message });
    setLoading(true);
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const result = await askAgent({
        accessToken,
        message,
        conversationId: activeConversationId,
        signal: controller.signal,
      });
      appendMessage({
        role: "assistant",
        text: result.answer,
        requestId: result.requestId,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        appendMessage({ role: "system", text: "Consulta cancelada." });
        return;
      }

      if (error instanceof AgentApiError) {
        // Una sesión vencida no es una respuesta del agente. El store ya está
        // cerrando la sesión por el hook de 401; acá sólo se explica por qué
        // la pantalla va a desaparecer.
        appendMessage({
          role: error.kind === "agent" ? "assistant" : "system",
          text: error.message,
          tone: "error",
          requestId: error.requestId,
        });
        return;
      }

      appendMessage({
        role: "system",
        text: "No se pudo conectar con el agente. Verificá que el servicio Node esté iniciado.",
        tone: "error",
      });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
        {/* Tapa de la hoja. No lleva acciones: separa el fondo atenuado del área
            de mensajes y le da un borde superior a la conversación, que si no
            arranca directo contra el scrim. */}
        <View
          style={{
            height: spacing["2xl"],
            backgroundColor: palette.background,
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
          }}
        />
        <ScrollView
          ref={scrollRef}
          // Fondo hundido para que las burbujas se lean como objetos y no como
          // texto sobre la misma superficie.
          style={{ flex: 1, backgroundColor: palette.surfaceSunken }}
          contentContainerStyle={{
            // Sin `flexGrow` el contenido se apila arriba y deja media pantalla
            // vacía. Con él, el saludo queda centrado mientras no hay
            // conversación, y una vez que arranca los mensajes cuelgan desde
            // abajo, que es como se lee un chat.
            flexGrow: 1,
            justifyContent: esEstadoInicial ? "center" : "flex-end",
            padding: spacing.lg,
            paddingBottom: spacing.lg + scrollBottomInset,
            gap: spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => {
            if (message.role === "system") {
              const esError = message.tone === "error";
              return (
                <View
                  key={message.id}
                  accessible
                  accessibilityRole="text"
                  style={{
                    alignSelf: "center",
                    maxWidth: "92%",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    {/* El color no puede ser la única señal de que algo falló. */}
                    {esError ? (
                      <Feather
                        name="alert-circle"
                        size={14}
                        color={palette.danger}
                      />
                    ) : null}
                    <Text
                      style={{
                        fontSize: 13,
                        lineHeight: 18,
                        textAlign: "center",
                        color: esError ? palette.danger : palette.subtext,
                      }}
                    >
                      {message.text}
                    </Text>
                  </View>
                  {message.requestId ? (
                    <Text
                      selectable
                      style={{
                        ...typography.caption,
                        color: palette.subtext,
                        marginTop: spacing.xs,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {`Ref. ${message.requestId.slice(0, 8)}`}
                    </Text>
                  ) : null}
                </View>
              );
            }

            const mine = message.role === "user";
            // `onPrimary` en vez de blanco fijo: sobre el azul del modo oscuro
            // el blanco daba 3,16:1, por debajo del 4,5:1 de WCAG AA.
            const color = mine
              ? palette.onPrimary
              : message.tone === "error"
                ? palette.danger
                : palette.text;

            return (
              <View
                key={message.id}
                style={{
                  maxWidth: "88%",
                  alignSelf: mine ? "flex-end" : "flex-start",
                }}
              >
                <SurfaceCard
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${mine ? "Vos" : "Agente"}: ${message.text}`}
                  style={{
                    backgroundColor: mine
                      ? palette.primary
                      : message.tone === "error"
                        ? palette.surfaceMuted
                        : palette.surface,
                  }}
                >
                  <AgentMarkdown
                    color={color}
                    bulletColor={mine ? palette.onPrimary : palette.subtext}
                    style={mensajeTexto}
                    gap={spacing.sm}
                  >
                    {message.text}
                  </AgentMarkdown>
                  {message.requestId && message.tone === "error" ? (
                    <Text
                      selectable
                      style={{
                        ...typography.caption,
                        color: palette.subtext,
                        marginTop: spacing.sm,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {`Ref. ${message.requestId.slice(0, 8)} · mencionala si reportás el problema`}
                    </Text>
                  ) : null}
                </SurfaceCard>
              </View>
            );
          })}

          {loading ? (
            <View
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.sm,
              }}
            >
              <ActivityIndicator color={palette.primary} />
              <Text style={{ color: palette.subtext, fontSize: 13 }}>
                Pensando…
              </Text>
            </View>
          ) : null}

          {esEstadoInicial ? (
            <View style={{ gap: spacing.sm, alignItems: "flex-start" }}>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => send(suggestion)}
                  disabled={!signedIn || loading}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !signedIn || loading }}
                  style={({ pressed }) => ({
                    // Antes medían ~40px de alto: por debajo del mínimo táctil
                    // de 44 que la propia app ya define en `layout.touchTarget`.
                    minHeight: layout.touchTarget,
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: pressed ? palette.primary : palette.border,
                    backgroundColor: pressed
                      ? palette.surfaceEmphasis
                      : "transparent",
                    borderRadius: radius.pill,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.sm + 2,
                    // Deshabilitado y presionado son estados distintos: antes
                    // los dos bajaban a 0.7 y no se podían diferenciar.
                    opacity: !signedIn || loading ? 0.4 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: palette.primary,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {!signedIn ? (
          <View
            style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
          >
            <Text
              style={{
                color: palette.danger,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Tu sesión no está activa. Volvé a iniciar sesión para usar el
              agente.
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.base,
            borderTopWidth: 1,
            borderTopColor: palette.border,
            backgroundColor: palette.background,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Preguntá por tus eventos"
            placeholderTextColor={palette.subtext}
            editable={!loading && signedIn}
            multiline
            maxLength={2_000}
            accessibilityLabel="Escribí tu pregunta"
            textAlignVertical="top"
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: COMPOSER_CONTROL,
              color: palette.text,
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              fontSize: 15,
              lineHeight: 20,
            }}
          />
          {loading ? (
            <ComposerButton
              onPress={cancel}
              label="Cancelar consulta"
              icon="square"
              accent={palette.danger}
              onAccent={palette.onPrimary}
              mutedSurface={palette.surfaceMuted}
              // Detener nunca es la acción primaria: contorno, no relleno.
              variant="outline"
            />
          ) : (
            <ComposerButton
              onPress={() => send()}
              disabled={!canSend}
              label="Enviar pregunta"
              icon="arrow-up"
              accent={palette.primary}
              onAccent={palette.primary}
              mutedSurface={palette.surfaceMuted}
            />
          )}
        </View>
    </KeyboardAvoidingView>
  );
};

export default AgentConversation;
