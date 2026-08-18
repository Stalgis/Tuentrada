import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { fetchEvents, invalidateEventsCache, retryFailedFunctionStats } from '../lib/apiClient';
import { currentGeneration, isCurrentGeneration } from '../lib/session';
import { useAuth } from './auth';
import type { Event, Language } from '../lib/types';
import type { ThemeName, ThemePreference } from '../lib/theme';

type EventsStatus = 'idle' | 'loading' | 'success' | 'error';

type EventsState = {
  data: Event[];
  status: EventsStatus;
  error?: string;
  /**
   * `true` mientras los importes por función todavía están llegando: los
   * eventos ya son listables, pero `ticketsSold` y `grossRevenueARS` valen 0
   * porque aún no se sabe. Las pantallas deben mostrar un marcador en vez de
   * cifras, que se leerían como ventas nulas reales.
   */
  statsPending: boolean;
  failedStatsIds: string[];
  statsRetrying: boolean;
};

type AppState = {
  language: Language;
  theme: ThemeName;
  themePreference: ThemePreference;
  events: EventsState;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  loadEvents: (token: string, force?: boolean) => Promise<void>;
  retryFailedStats: (token: string) => Promise<void>;
  clearEventsCache: () => void;
};

const AppStateContext = createContext<AppState | undefined>(undefined);

export const AppStateProvider = ({ children }: PropsWithChildren) => {
  const [language, setLanguage] = useState<Language>('es');
  const [themePreference, setTheme] = useState<ThemePreference>('system');
  const systemScheme = useColorScheme();
  const theme: ThemeName =
    themePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePreference;
  const [events, setEvents] = useState<EventsState>({
    data: [],
    status: 'idle',
    statsPending: false,
    failedStatsIds: [],
    statsRetrying: false,
  });
  const eventsRequestIdRef = useRef(0);
  const activeEventsLoadRef = useRef<{
    id: number;
    generation: number;
    promise: Promise<void>;
  } | null>(null);
  const lastSuccessfulEventsRef = useRef<Event[]>([]);
  const failedStatsIdsRef = useRef<string[]>([]);
  const statsRetryingRef = useRef(false);
  const statsRetryIdRef = useRef(0);

  // Los datos comerciales pertenecen a una sesión: al iniciar o cerrar una,
  // el estado vuelve a 'idle' para que las pantallas recarguen desde cero.
  const { sessionGeneration } = useAuth();
  useEffect(() => {
    // Los efectos de una pantalla hija pueden iniciar la carga antes que este
    // efecto del provider. Si ya pertenece a la sesión recién publicada, no la
    // invalidamos: startSession ya limpió todas las cachés antes de autenticar.
    if (activeEventsLoadRef.current?.generation === sessionGeneration) {
      return;
    }
    eventsRequestIdRef.current += 1;
    activeEventsLoadRef.current = null;
    lastSuccessfulEventsRef.current = [];
    failedStatsIdsRef.current = [];
    statsRetryingRef.current = false;
    statsRetryIdRef.current += 1;
    setEvents({
      data: [],
      status: 'idle',
      statsPending: false,
      failedStatsIds: [],
      statsRetrying: false,
    });
  }, [sessionGeneration]);

  const loadEvents = useCallback((token: string, force = false): Promise<void> => {
    if (!force && activeEventsLoadRef.current) {
      return activeEventsLoadRef.current.promise;
    }

    // Generación capturada antes de salir: si cambia, la respuesta se descarta
    // en lugar de repoblar el estado de una sesión que ya terminó.
    const gen = currentGeneration();
    const requestId = ++eventsRequestIdRef.current;
    statsRetryingRef.current = false;
    statsRetryIdRef.current += 1;
    const isActive = () =>
      eventsRequestIdRef.current === requestId && isCurrentGeneration(gen);

    setEvents((prev) => ({
      ...prev,
      // Con datos ya en pantalla no volvemos a 'loading': al refrescar, la
      // lista sigue visible en vez de parpadear a vacío.
      status: prev.data.length > 0 ? prev.status : 'loading',
      error: undefined,
    }));

    const promise = (async () => {
      try {
        // El catálogo llega mucho antes que los importes; lo publicamos apenas
        // está para que la lista se vea, y completamos al terminar el fan-out.
        const response = await fetchEvents(token, (partial) => {
          if (!isActive()) return;
          setEvents({
            data: partial,
            status: 'success',
            statsPending: true,
            failedStatsIds: [],
            statsRetrying: false,
          });
        });
        if (!isActive()) return;
        lastSuccessfulEventsRef.current = response.events;
        failedStatsIdsRef.current = response.failedIds;
        setEvents({
          data: response.events,
          status: 'success',
          statsPending: false,
          failedStatsIds: response.failedIds,
          statsRetrying: false,
        });
      } catch (error) {
        if (!isActive()) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        const previousData = lastSuccessfulEventsRef.current;
        setEvents(
          previousData.length > 0
            ? {
                data: previousData,
                status: 'success',
                statsPending: false,
                failedStatsIds: failedStatsIdsRef.current,
                statsRetrying: false,
                error: message,
              }
            : {
                data: [],
                status: 'error',
                statsPending: false,
                failedStatsIds: [],
                statsRetrying: false,
                error: message,
              },
        );
      } finally {
        if (activeEventsLoadRef.current?.id === requestId) {
          activeEventsLoadRef.current = null;
        }
      }
    })();

    activeEventsLoadRef.current = { id: requestId, generation: gen, promise };
    return promise;
  }, []);

  const retryFailedStats = useCallback(async (token: string): Promise<void> => {
    if (statsRetryingRef.current) return;
    const functionIds = failedStatsIdsRef.current;
    const currentEvents = lastSuccessfulEventsRef.current;
    if (functionIds.length === 0 || currentEvents.length === 0) return;

    const gen = currentGeneration();
    const requestId = eventsRequestIdRef.current;
    const retryId = ++statsRetryIdRef.current;
    const isActive = () =>
      eventsRequestIdRef.current === requestId && isCurrentGeneration(gen);
    statsRetryingRef.current = true;
    setEvents((prev) => ({ ...prev, statsRetrying: true, error: undefined }));
    try {
      const result = await retryFailedFunctionStats(token, currentEvents, functionIds);
      if (!isActive()) return;
      lastSuccessfulEventsRef.current = result.events;
      failedStatsIdsRef.current = result.failedIds;
      setEvents((prev) => ({
        ...prev,
        data: result.events,
        failedStatsIds: result.failedIds,
        statsRetrying: false,
      }));
    } catch (error) {
      if (!isActive()) return;
      setEvents((prev) => ({
        ...prev,
        statsRetrying: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      if (statsRetryIdRef.current === retryId) {
        statsRetryingRef.current = false;
      }
    }
  }, []);

  const clearEventsCache = useCallback(() => {
    eventsRequestIdRef.current += 1;
    activeEventsLoadRef.current = null;
    lastSuccessfulEventsRef.current = [];
    failedStatsIdsRef.current = [];
    statsRetryingRef.current = false;
    statsRetryIdRef.current += 1;
    invalidateEventsCache();
    setEvents({
      data: [],
      status: 'idle',
      statsPending: false,
      failedStatsIds: [],
      statsRetrying: false,
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      language,
      theme,
      themePreference,
      events,
      setLanguage,
      setTheme,
      loadEvents,
      retryFailedStats,
      clearEventsCache,
    }),
    [language, theme, themePreference, events, loadEvents, retryFailedStats, clearEventsCache],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
};
