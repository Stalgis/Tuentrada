import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import type { PropsWithChildren } from "react";
import {
  DEFAULT_PREFERENCES,
  PUSH_BACKEND_READY,
  PUSH_FEATURE_ENABLED,
  buildRegistration,
  hasAnyCategoryEnabled,
  readStoredPreferences,
  registerDevice,
  savePreferences,
  type NotificationCategory,
  type NotificationPreferences,
} from "../lib/pushApi";
import {
  configureForegroundHandler,
  ensureAndroidChannels,
  getExpoPushToken,
  getPermissionState,
  isPushSupported,
  openSystemSettings,
  pushUnsupportedReason,
  requestPermission,
  type PermissionState,
} from "../lib/pushNotifications";
import { currentGeneration, isCurrentGeneration } from "../lib/session";
import { useAuth } from "./auth";

type PushContextValue = {
  /** El entorno soporta push y el feature está habilitado en esta build. */
  available: boolean;
  unsupportedReason?: string;
  /** `false` mientras el backend no pueda enviar: la UI no debe prometerlo. */
  backendReady: boolean;
  permission: PermissionState;
  preferences: NotificationPreferences;
  /** Categoría cuyo interruptor está trabajando, para bloquear el toque doble. */
  busyCategory: NotificationCategory | null;
  error?: string;
  setCategory: (category: NotificationCategory, enabled: boolean) => Promise<void>;
  openSettings: () => Promise<void>;
};

const PushContext = createContext<PushContextValue | undefined>(undefined);

export const PushProvider = ({ children }: PropsWithChildren) => {
  const { accessToken, sessionGeneration } = useAuth();
  const [permission, setPermission] = useState<PermissionState>("undetermined");
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [busyCategory, setBusyCategory] = useState<NotificationCategory | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const supported = isPushSupported();
  const available = supported && PUSH_FEATURE_ENABLED;
  const unsupportedReason = supported
    ? undefined
    : pushUnsupportedReason();
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  // El handler de primer plano se registra en un efecto y no al importar el
  // módulo: una llamada al módulo nativo en el cuerpo del archivo se ejecuta
  // mientras se evalúa el bundle, y si falla —Expo Go, un entorno sin el
  // módulo— no hay app que mostrar, sólo pantalla en blanco.
  useEffect(() => {
    try {
      configureForegroundHandler();
    } catch {
      // Sin handler los avisos igual llegan; sólo no se muestran en primer plano.
    }
  }, []);

  const syncPermission = useCallback(async () => {
    const gen = currentGeneration();
    const state = await getPermissionState();
    if (!isCurrentGeneration(gen)) return;
    setPermission(state);
  }, []);

  // Las preferencias pertenecen a la sesión: al cerrarla se borran del
  // almacenamiento, así que hay que releerlas en cada cambio de generación en
  // lugar de arrastrar las de la cuenta anterior.
  useEffect(() => {
    let cancelled = false;
    const gen = currentGeneration();

    (async () => {
      const [stored, state] = await Promise.all([readStoredPreferences(), getPermissionState()]);
      if (cancelled || !isCurrentGeneration(gen)) return;
      setPreferences(stored);
      setPermission(state);
      setError(undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionGeneration]);

  /**
   * Refresco del registro en cada inicio de sesión.
   *
   * El ExpoPushToken cambia al reinstalar la app o al restaurar el teléfono, y
   * la versión de app del registro envejece con cada release. Sin este paso el
   * backend seguiría enviando a un token muerto hasta que Expo lo rechace.
   */
  useEffect(() => {
    if (!accessToken || !available) return;
    let cancelled = false;
    const gen = currentGeneration();

    (async () => {
      const [stored, state] = await Promise.all([readStoredPreferences(), getPermissionState()]);
      if (cancelled || !isCurrentGeneration(gen)) return;
      if (state !== "granted" || !hasAnyCategoryEnabled(stored)) return;

      try {
        const expoPushToken = await getExpoPushToken();
        if (cancelled || !isCurrentGeneration(gen)) return;
        await registerDevice(accessToken, buildRegistration(expoPushToken));
      } catch {
        // Un fallo acá no bloquea nada: el próximo inicio de sesión reintenta.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, available]);

  // El usuario puede conceder o revocar el permiso desde los ajustes del
  // sistema, fuera de la app. Al volver, el estado que muestra la pantalla
  // tiene que ser el real, no el que teníamos antes de salir.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void syncPermission();
      }
    });
    return () => subscription.remove();
  }, [syncPermission]);

  const setCategory = useCallback(
    async (category: NotificationCategory, enabled: boolean) => {
      const gen = currentGeneration();
      setBusyCategory(category);
      setError(undefined);

      try {
        if (enabled) {
          if (!available) {
            setError(unsupportedReason ?? "Los avisos todavía no están disponibles.");
            return;
          }

          const granted = await requestPermission();
          if (!isCurrentGeneration(gen)) return;
          setPermission(granted);

          if (granted !== "granted") {
            setError(
              granted === "denied"
                ? "Las notificaciones están bloqueadas desde los ajustes del teléfono."
                : "Necesitamos tu permiso para enviarte avisos.",
            );
            return;
          }

          await ensureAndroidChannels();
        }

        const next: NotificationPreferences = { ...preferences, [category]: enabled };
        const token = accessTokenRef.current;

        if (enabled) {
          if (!token) {
            setError("Iniciá sesión para activar los avisos.");
            return;
          }
          // El dispositivo se registra recién cuando hay algo para enviarle.
          const expoPushToken = await getExpoPushToken();
          if (!isCurrentGeneration(gen)) return;
          await registerDevice(token, buildRegistration(expoPushToken));
        }

        await savePreferences(next, token);

        if (!isCurrentGeneration(gen)) return;
        setPreferences(next);
      } catch (err) {
        if (!isCurrentGeneration(gen)) return;
        setError(
          err instanceof Error ? err.message : "No se pudo actualizar la preferencia.",
        );
      } finally {
        if (isCurrentGeneration(gen)) {
          setBusyCategory(null);
        }
      }
    },
    [available, preferences, unsupportedReason],
  );

  const value = useMemo<PushContextValue>(
    () => ({
      available,
      unsupportedReason,
      backendReady: PUSH_BACKEND_READY,
      permission,
      preferences,
      busyCategory,
      error,
      setCategory,
      openSettings: openSystemSettings,
    }),
    [available, busyCategory, error, permission, preferences, setCategory, unsupportedReason],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
};

export const usePush = () => {
  const context = useContext(PushContext);
  if (!context) {
    throw new Error("usePush debe usarse dentro de PushProvider");
  }
  return context;
};
