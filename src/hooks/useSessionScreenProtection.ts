import { useEffect } from "react";
import { Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

/**
 * Protege la información comercial mientras hay sesión iniciada.
 *
 * - iOS: oculta la interfaz en el selector de apps (app switcher).
 * - Android: FLAG_SECURE — deja en blanco "Recientes" y bloquea capturas.
 *
 * Se aplica a toda la sesión autenticada, no a una lista de pantallas: enumerar
 * pantallas se desactualiza en cuanto se agrega una nueva con datos sensibles.
 */
export const useSessionScreenProtection = (enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return;

    const apply = async () => {
      try {
        if (Platform.OS === "ios") {
          await ScreenCapture.enableAppSwitcherProtectionAsync();
        } else if (Platform.OS === "android") {
          await ScreenCapture.preventScreenCaptureAsync();
        }
      } catch {
        // Best-effort: si el módulo nativo no está disponible (p. ej. Expo Go)
        // no se interrumpe la app.
      }
    };

    const release = async () => {
      try {
        if (Platform.OS === "ios") {
          await ScreenCapture.disableAppSwitcherProtectionAsync();
        } else if (Platform.OS === "android") {
          await ScreenCapture.allowScreenCaptureAsync();
        }
      } catch {
        // idem
      }
    };

    apply();
    return () => {
      release();
    };
  }, [enabled]);
};
