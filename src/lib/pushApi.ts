import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { env } from "./env";
import { backendFetch } from "./backendFetch";
import { ApiTimeoutError, ApiUnauthorizedError, notifyUnauthorized } from "./reportApi";
import { currentGeneration, isCurrentGeneration } from "./session";
import { DEFAULT_PREFERENCES, notificationPreferencesSchema, type NotificationPreferences } from "../../shared/notifications";

export { DEFAULT_PREFERENCES };
export type { NotificationPreferences };
export type NotificationCategory = "functionReports" | "weeklySummary";
export const PUSH_BACKEND_READY = Boolean(env.notificationsApiUrl);
export const PUSH_FEATURE_ENABLED = PUSH_BACKEND_READY;
export const hasAnyCategoryEnabled = (p: NotificationPreferences): boolean => p.functionReports || p.weeklySummary;
const PUSH_TOKEN_KEY = "tuentrada_push_token";
const LEGACY_PREFERENCES_KEY = "tuentrada_notification_prefs";
const REQUEST_TIMEOUT_MS = 20_000;

// Serializa escritura/borrado: una respuesta anterior al logout nunca puede
// repoblar SecureStore después de que la limpieza termine.
let storageQueue: Promise<unknown> = Promise.resolve();
const storageOperation = <T,>(action: () => Promise<T>): Promise<T> => {
  const result = storageQueue.then(action, action);
  storageQueue = result.catch(() => {});
  return result;
};

export const notificationFetch = async (
  path: string,
  accessToken: string,
  init: { method: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal },
  gen = currentGeneration(),
): Promise<unknown> => {
  if (!env.notificationsApiUrl) throw new Error("Los avisos todavía no están disponibles.");
  if (!isCurrentGeneration(gen)) throw new Error("La sesión cambió.");
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await backendFetch(`${env.notificationsApiUrl}${path}`, {
      method: init.method,
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    if (response.status === 401) {
      notifyUnauthorized(gen);
      throw new ApiUnauthorizedError();
    }
    if (!response.ok) {
      const error = new Error("No se pudo completar la solicitud. Intentá de nuevo.");
      Object.assign(error, { status: response.status });
      throw error;
    }
    if (response.status === 204) return undefined;
    const json = await response.json();
    if (!isCurrentGeneration(gen)) throw new Error("La sesión cambió.");
    return json.data;
  } catch (error) {
    if (timedOut) throw new ApiTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
};

// Las preferencias se leen del servidor autenticado, nunca de una clave global
// del teléfono. Un reinicio sin logout tampoco transfiere el opt-in de A a B.
export const loadPreferences = async (accessToken: string, signal?: AbortSignal): Promise<NotificationPreferences> =>
  notificationPreferencesSchema.parse(await notificationFetch("/api/v1/notification-preferences", accessToken, { method: "GET", signal }));

export const savePreferences = async (preferences: NotificationPreferences, accessToken: string, signal?: AbortSignal): Promise<void> => {
  await notificationFetch("/api/v1/notification-preferences", accessToken, { method: "PUT", body: preferences, signal });
};
export const deviceTimezone = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires"; }
  catch { return "America/Argentina/Buenos_Aires"; }
};
export type DeviceRegistration = {
  expoPushToken: string;
  platform: "ios" | "android";
  appVersion: string;
  timezone: string;
  language: string;
};
export const buildRegistration = (expoPushToken: string): DeviceRegistration => ({
  expoPushToken, platform: Platform.OS === "ios" ? "ios" : "android",
  appVersion: Constants.expoConfig?.version ?? "desconocida", timezone: deviceTimezone(), language: "es",
});
export const readStoredPushToken = (): Promise<string | null> => storageOperation(async () => {
  try { return await SecureStore.getItemAsync(PUSH_TOKEN_KEY); } catch { return null; }
});
export const registerDevice = async (accessToken: string, registration: DeviceRegistration, signal?: AbortSignal): Promise<void> => {
  const gen = currentGeneration();
  await notificationFetch("/api/v1/devices", accessToken, { method: "POST", body: registration, signal }, gen);
  await storageOperation(async () => {
    if (isCurrentGeneration(gen) && !signal?.aborted) await SecureStore.setItemAsync(PUSH_TOKEN_KEY, registration.expoPushToken);
  });
};
export const clearStoredPushState = (): Promise<void> => storageOperation(async () => {
  await Promise.all([SecureStore.deleteItemAsync(PUSH_TOKEN_KEY), SecureStore.deleteItemAsync(LEGACY_PREFERENCES_KEY)]);
});
// Encolar al iniciar el logout, antes de cualquier await: una sesión nueva
// registrará su token después de esta operación indivisible.
export const takeStoredPushToken = (): Promise<string | null> => storageOperation(async () => {
  let token: string | null = null;
  try { token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY); } catch { /* Sin caché. */ }
  await Promise.allSettled([SecureStore.deleteItemAsync(PUSH_TOKEN_KEY), SecureStore.deleteItemAsync(LEGACY_PREFERENCES_KEY)]);
  return token;
});
export const unregisterDevice = async (accessToken: string, expoPushToken: string): Promise<void> => {
  if (!env.notificationsApiUrl) return;
  // No se usa notificationFetch: el token pertenece a la sesión que acaba de
  // cerrarse y un 401 suyo no puede invalidar la sesión siguiente.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await backendFetch(`${env.notificationsApiUrl}/api/v1/devices/${encodeURIComponent(expoPushToken)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
    });
  } catch { /* El servidor también aplica vencimiento a los registros. */ }
  finally { clearTimeout(timer); }
};
