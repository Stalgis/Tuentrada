import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { env } from "./env";
import { backendFetch } from "./backendFetch";

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
 * Guarda siempre en el dispositivo y, si hay sesión, replica en el backend:
 * quien filtra los envíos es el backend, pero la pantalla tiene que reflejar
 * lo elegido aunque la red falle.
 */
export const savePreferences = async (
  preferences: NotificationPreferences,
  accessToken?: string,
): Promise<void> => {
  await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(preferences));

  if (!accessToken) return;

  if (!PUSH_BACKEND_READY) {
    logSimulated("PUT /api/v1/notification-preferences", preferences);
    return;
  }

  await backendFetch(`${env.baseUrl}/api/v1/notification-preferences`, {
    method: "PUT",
    headers: makeHeaders(accessToken),
    body: JSON.stringify(preferences),
  });
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
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, registration.expoPushToken);

  if (!PUSH_BACKEND_READY) {
    logSimulated("POST /api/v1/devices", registration);
    return;
  }

  await backendFetch(`${env.baseUrl}/api/v1/devices`, {
    method: "POST",
    headers: makeHeaders(accessToken),
    body: JSON.stringify(registration),
  });
};

/**
 * Baja del dispositivo en el cierre de sesión manual. No propaga errores: el
 * cierre de sesión no puede quedar colgado de una petición de red, y el
 * backend igual invalida el token cuando Apple o Google lo rechacen.
 */
export const unregisterDeviceOnLogout = async (accessToken: string): Promise<void> => {
  const expoPushToken = await readStoredPushToken();

  await Promise.all([
    SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => {}),
    // Las preferencias son de este usuario, no del teléfono: si entra otra
    // cuenta no debe heredar los interruptores de la anterior.
    SecureStore.deleteItemAsync(PREFERENCES_KEY).catch(() => {}),
  ]);

  if (!expoPushToken) return;

  if (!PUSH_BACKEND_READY) {
    logSimulated("DELETE /api/v1/devices", { expoPushToken });
    return;
  }

  try {
    await backendFetch(`${env.baseUrl}/api/v1/devices/${encodeURIComponent(expoPushToken)}`, {
      method: "DELETE",
      headers: makeHeaders(accessToken),
    });
  } catch {
    // silencio deliberado: ver comentario del bloque
  }
};
