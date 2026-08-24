import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import { SafeAreaView } from "react-native-safe-area-context";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { AgentApiError, askAgent } from "../lib/agentApi";
import { radius, spacing, typography } from "../lib/design";
import { getPalette } from "../lib/theme";
import type { AppStackParamList } from "../navigation/types";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
};

const suggestions = [
  "¿Cuántos eventos tengo?",
  "Listá mis próximos eventos",
  "Buscá eventos que contengan festival",
];

const AgentChat = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme } = useAppState();
  const { accessToken, user } = useAuth();
  const palette = getPalette(theme);
  const scrollRef = useRef<ScrollView>(null);
  const requestRef = useRef<AbortController | null>(null);
  const nextIdRef = useRef(2);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Esta prueba usa tu catálogo real. Por ahora puedo listar, contar y buscar eventos; todavía no consulto ventas ni recaudación.",
    },
  ]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  const appendMessage = (message: Omit<ChatMessage, "id">) => {
    const id = nextIdRef.current++;
    setMessages((current) => [...current, { ...message, id }]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
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
        signal: controller.signal,
      });
      appendMessage({ role: "assistant", text: result.answer });
    } catch (error) {
      if (controller.signal.aborted) return;
      const text =
        error instanceof AgentApiError
          ? error.message
          : "No se pudo conectar con el agente. Verificá que el servicio Node esté iniciado.";
      appendMessage({ role: "assistant", text, error: true });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AppHeader
          title="Agente beta"
          subtitle="Prueba con catálogo real"
          avatarInitials={user?.initials}
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => {
            const mine = message.role === "user";
            return (
              <View
                key={message.id}
                style={{
                  maxWidth: "88%",
                  alignSelf: mine ? "flex-end" : "flex-start",
                }}
              >
                <SurfaceCard
                  style={{
                    backgroundColor: mine
                      ? palette.primary
                      : message.error
                        ? palette.surfaceMuted
                        : palette.surface,
                  }}
                >
                  <Text
                    style={{
                      ...typography.body,
                      color: mine
                        ? "#ffffff"
                        : message.error
                          ? palette.danger
                          : palette.text,
                    }}
                  >
                    {message.text}
                  </Text>
                </SurfaceCard>
              </View>
            );
          })}

          {loading ? (
            <View style={{ alignSelf: "flex-start", paddingVertical: spacing.sm }}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : null}

          {messages.length === 1 ? (
            <View style={{ gap: spacing.sm }}>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => send(suggestion)}
                  style={({ pressed }) => ({
                    borderWidth: 1,
                    borderColor: palette.border,
                    borderRadius: radius.pill,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.sm + 2,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: palette.primary, fontWeight: "700" }}>
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
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
            editable={!loading}
            multiline
            maxLength={2_000}
            onSubmitEditing={() => send()}
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 46,
              color: palette.text,
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={() => send()}
            disabled={loading || !input.trim()}
            accessibilityRole="button"
            accessibilityLabel="Enviar pregunta"
            style={({ pressed }) => ({
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.primary,
              opacity: loading || !input.trim() ? 0.4 : pressed ? 0.75 : 1,
            })}
          >
            <Feather name="arrow-up" size={20} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AgentChat;
