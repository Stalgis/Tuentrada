import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { env } from "./env";
import { backendFetch } from "./backendFetch";
import { ApiTimeoutError, ApiUnauthorizedError, notifyUnauthorized } from "./reportApi";
import { currentGeneration } from "./session";

/**
 * Registro de dispositivos y preferencias de notificación.
 *
 * El backend todavía no expone estos endpoints (fases 2 y 3 del plan), así que
 * el flujo completo corre contra un backend simulado: la app pide el permiso,
 * obtiene el ExpoPushToken real y guarda las preferencias localmente. Cuando
 * los endpoints existan alcanza con poner `PUSH_BACKEND_READY` en `true`; las
 * firmas y los payloads ya son los definitivos.
 *
 * El dispositivo se registra con el Bearer de la sesión y sin identificar al
 * usuario en el cuerpo: hoy `user.id` es el email (ver `authApi.ts`) y no sirve
 * como clave. Que el backend resuelva `user_id` y `account_id` desde el token.
 */
export const PUSH_BACKEND_READY = false;

/**
 * Mientras el backend no exista, el feature sólo se ofrece en desarrollo: sirve
 * para obtener el token y probar el camino completo. En una build de release
 * los interruptores quedan deshabilitados, porque prometer un aviso que nadie
 * puede enviar es peor que no ofrecerlo.
 */
export const PUSH_FEATURE_ENABLED = PUSH_BACKEND_READY || __DEV__;

const PREFERENCES_KEY = "tuentrada_notification_prefs";
const PUSH_TOKEN_KEY = "tuentrada_push_token";

export type NotificationCategory = "functionReports" | "weeklySummary";

export type NotificationPreferences = {
  /** Aviso cuando cierra una función y su informe queda listo. */
  functionReports: boolean;
  /** Resumen de la semana anterior. */
  weeklySummary: boolean;
};

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  functionReports: false,
  weeklySummary: false,
};

export const hasAnyCategoryEnabled = (preferences: NotificationPreferences): boolean =>
  preferences.functionReports || preferences.weeklySummary;

const makeHeaders = (accessToken: string): Record<string, string> => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Bearer ${accessToken}`,
  "x-api-key": env.apiKey,
});

// Mismo tope que el resto del backend: el gateway corta a los ~31s con un 504.
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * `backendFetch` es un fetch pelado: no rechaza ante 401, 404 ni 500. Sin esta
 * envoltura, un PUT fallido se leería como éxito y la app mostraría el
 * interruptor activo con el backend sin enterarse. El 401 además avisa al
 * AuthProvider, igual que las peticiones de reportes.
 */
const pushFetch = async (
  path: string,
  accessToken: string,
  init: { method: "POST" | "PUT" | "DELETE"; body?: unknown },
): Promise<void> => {
  const gen = currentGeneration();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await backendFetch(`${env.baseUrl}${path}`, {
      method: init.method,
      headers: makeHeaders(accessToken),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });

    if (response.status === 401) {
      notifyUnauthorized(gen);
      throw new ApiUnauthorizedError();
    }

    if (!response.ok) {
      throw new Error("No se pudo guardar la preferencia. Intentá de nuevo.");
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const logSimulated = (action: string, payload: unknown): void => {
  if (__DEV__) {
    console.log(`[push:simulado] ${action}`, payload);
  }
};

const isPreferences = (value: unknown): value is NotificationPreferences => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.functionReports === "boolean" &&
    typeof candidate.weeklySummary === "boolean"
  );
};

export const deviceTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires";
  } catch {
    return "America/Argentina/Buenos_Aires";
  }
};

export type DeviceRegistration = {
  expoPushToken: string;
  platform: "ios" | "android";
  appVersion: string;
  timezone: string;
  language: string;
};

export const buildRegistration = (expoPushToken: string): DeviceRegistration => ({
  expoPushToken,
  platform: Platform.OS === "ios" ? "ios" : "android",
  appVersion: Constants.expoConfig?.version ?? "desconocida",
  timezone: deviceTimezone(),
  language: "es",
});

// ─── Preferencias ─────────────────────────────────────────────────────────────

export const readStoredPreferences = async (): Promise<NotificationPreferences> => {
  try {
    const raw = await SecureStore.getItemAsync(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    return isPreferences(parsed) ? parsed : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

/**
 * El backend manda primero y el guardado local va después: quien filtra los
 * envíos es el servidor, así que una preferencia que él no registró no puede
 * quedar marcada como activa en la pantalla. Si el PUT falla, no se persiste
 * nada y el interruptor vuelve a donde estaba.
 */
export const savePreferences = async (
  preferences: NotificationPreferences,
  accessToken?: string,
): Promise<void> => {
  if (accessToken) {
    if (PUSH_BACKEND_READY) {
      await pushFetch("/api/v1/notification-preferences", accessToken, {
        method: "PUT",
        body: preferences,
      });
    } else {
      logSimulated("PUT /api/v1/notification-preferences", preferences);
    }
  }

  await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(preferences));
};

// ─── Dispositivos ─────────────────────────────────────────────────────────────

export const readStoredPushToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const registerDevice = async (
  accessToken: string,
  registration: DeviceRegistration,
): Promise<void> => {
  if (PUSH_BACKEND_READY) {
    await pushFetch("/api/v1/devices", accessToken, {
      method: "POST",
      body: registration,
    });
  } else {
    logSimulated("POST /api/v1/devices", registration);
  }

  // Se guarda después del alta: un token que el backend no aceptó no debe
  // quedar registrado acá como si estuviera activo.
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, registration.expoPushToken);
};

/**
 * Borra el estado local de notificaciones. Se llama en **todo** cierre de
 * sesión, no sólo en el manual: las preferencias viven en un almacenamiento
 * global del teléfono, así que si la sesión de A vence y entra B, B heredaría
 * los interruptores de A y su dispositivo se registraría sin que lo pidiera.
 */
export const clearStoredPushState = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(PREFERENCES_KEY).catch(() => {}),
  ]);
};

/**
 * Baja del dispositivo en el backend, sólo en el cierre manual. No propaga
 * errores: el cierre de sesión no puede quedar colgado de una petición de red,
 * y el backend igual invalida el token cuando Apple o Google lo rechacen.
 */
export const unregisterDevice = async (
  accessToken: string,
  expoPushToken: string,
): Promise<void> => {
  if (!PUSH_BACKEND_READY) {
    logSimulated("DELETE /api/v1/devices", { expoPushToken });
    return;
  }

  try {
    await pushFetch(`/api/v1/devices/${encodeURIComponent(expoPushToken)}`, accessToken, {
      method: "DELETE",
    });
  } catch {
    // silencio deliberado: ver comentario del bloque
  }
};
