import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import {
  DEFAULT_PREFERENCES, PUSH_BACKEND_READY, PUSH_FEATURE_ENABLED, buildRegistration,
  loadPreferences, registerDevice, savePreferences,
  type NotificationCategory, type NotificationPreferences,
} from "../lib/pushApi";
import {
  configureForegroundHandler, ensureAndroidChannels, getExpoPushToken, getPermissionState,
  isPushSupported, openSystemSettings, pushUnsupportedReason, requestPermission, type PermissionState,
} from "../lib/pushNotifications";
import { isCurrentGeneration } from "../lib/session";
import { useAuth } from "./auth";

type PushContextValue = {
  available: boolean;
  unsupportedReason?: string;
  backendReady: boolean;
  permission: PermissionState;
  preferences: NotificationPreferences;
  busyCategory: NotificationCategory | null;
  initializing: boolean;
  preferencesReady: boolean;
  error?: string;
  setCategory: (category: NotificationCategory, enabled: boolean) => Promise<void>;
  openSettings: () => Promise<void>;
  refresh: () => Promise<void>;
};
const PushContext = createContext<PushContextValue | undefined>(undefined);
export const PushProvider = ({ children }: PropsWithChildren) => {
  const { accessToken, sessionGeneration } = useAuth();
  const [permission, setPermission] = useState<PermissionState>("undetermined");
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [busyCategory, setBusyCategory] = useState<NotificationCategory | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const syncing = useRef(false);
  const operations = useRef(new Set<AbortController>());
  const supported = isPushSupported();
  const available = supported && PUSH_FEATURE_ENABLED;

  useEffect(() => {
    try { configureForegroundHandler(); } catch { /* Sin módulo nativo. */ }
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current || syncing.current) return;
    const gen = sessionGeneration;
    if (!isCurrentGeneration(gen)) return;
    syncing.current = true;
    setInitializing(true);
    const controller = new AbortController();
    operations.current.add(controller);
    try {
      const state = await getPermissionState();
      const stored = accessToken && available ? await loadPreferences(accessToken, controller.signal) : DEFAULT_PREFERENCES;
      if (!isCurrentGeneration(gen) || controller.signal.aborted) return;
      setPermission(state);
      setPreferences(stored);
      setPreferencesReady(true);
      setError(undefined);
      if (accessToken && available && state === "granted") {
        await ensureAndroidChannels();
        const token = await getExpoPushToken();
        if (!isCurrentGeneration(gen) || controller.signal.aborted) return;
        await registerDevice(accessToken, buildRegistration(token), controller.signal);
      }
    } catch (err) {
      if (isCurrentGeneration(gen) && !controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar los avisos.");
      }
    } finally {
      operations.current.delete(controller);
      if (isCurrentGeneration(gen)) { syncing.current = false; setInitializing(false); }
    }
  }, [accessToken, available, sessionGeneration]);

  useEffect(() => {
    const pending = operations.current;
    for (const controller of pending) controller.abort();
    pending.clear();
    busy.current = false;
    syncing.current = false;
    setBusyCategory(null);
    setPreferences(DEFAULT_PREFERENCES);
    setPreferencesReady(false);
    setError(undefined);
    setInitializing(true);
    void refresh();
    return () => {
      for (const controller of pending) controller.abort();
      pending.clear();
    };
  }, [sessionGeneration, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", next => { if (next === "active") void refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const setCategory = useCallback(async (category: NotificationCategory, enabled: boolean) => {
    if (busy.current || syncing.current || initializing || !preferencesReady || !accessToken || !available) return;
    const gen = sessionGeneration;
    if (!isCurrentGeneration(gen)) return;
    const controller = new AbortController();
    operations.current.add(controller);
    busy.current = true;
    setBusyCategory(category);
    setError(undefined);
    const current = () => isCurrentGeneration(gen) && !controller.signal.aborted;
    try {
      if (enabled) {
        await ensureAndroidChannels();
        if (!current()) return;
        const granted = await requestPermission();
        if (!current()) return;
        setPermission(granted);
        if (granted !== "granted") {
          setError(granted === "denied" ? "Habilitá las notificaciones en los ajustes del teléfono." : "Necesitamos tu permiso para enviarte avisos.");
          return;
        }
        const token = await getExpoPushToken();
        if (!current()) return;
        await registerDevice(accessToken, buildRegistration(token), controller.signal);
      }
      if (!current()) return;
      const next = { ...preferences, [category]: enabled };
      await savePreferences(next, accessToken, controller.signal);
      if (current()) setPreferences(next);
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : "No se pudo actualizar la preferencia.");
    } finally {
      operations.current.delete(controller);
      if (isCurrentGeneration(gen)) { busy.current = false; setBusyCategory(null); }
    }
  }, [accessToken, available, initializing, preferences, preferencesReady, sessionGeneration]);

  return <PushContext.Provider value={{
    available, unsupportedReason: supported ? undefined : pushUnsupportedReason(),
    backendReady: PUSH_BACKEND_READY, permission, preferences, busyCategory,
    initializing, preferencesReady, error, setCategory, refresh, openSettings: openSystemSettings,
  }}>{children}</PushContext.Provider>;
};
export const usePush = () => {
  const context = useContext(PushContext);
  if (!context) throw new Error("usePush debe usarse dentro de PushProvider");
  return context;
};
