import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { fetchEvents, invalidateEventsCache } from '../lib/apiClient';
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
  statsPending?: boolean;
};

type AppState = {
  language: Language;
  theme: ThemeName;
  themePreference: ThemePreference;
  events: EventsState;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  loadEvents: (token: string) => Promise<void>;
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
  });

  // Los datos comerciales pertenecen a una sesión: al iniciar o cerrar una,
  // el estado vuelve a 'idle' para que las pantallas recarguen desde cero.
  const { sessionGeneration } = useAuth();
  useEffect(() => {
    setEvents({ data: [], status: 'idle' });
  }, [sessionGeneration]);

  const loadEvents = useCallback(async (token: string) => {
    if (events.status === 'loading') {
      return;
    }

    // Generación capturada antes de salir: si cambia, la respuesta se descarta
    // en lugar de repoblar el estado de una sesión que ya terminó.
    const gen = currentGeneration();

    setEvents((prev) => ({
      ...prev,
      // Con datos ya en pantalla no volvemos a 'loading': al refrescar, la
      // lista sigue visible en vez de parpadear a vacío.
      status: prev.data.length > 0 ? prev.status : 'loading',
      error: undefined,
    }));

    try {
      // El catálogo llega mucho antes que los importes; lo publicamos apenas
      // está para que la lista se vea, y completamos al terminar el fan-out.
      const response = await fetchEvents(token, (partial) => {
        if (!isCurrentGeneration(gen)) return;
        setEvents({
          data: partial,
          status: 'success',
          statsPending: true,
        });
      });
      if (!isCurrentGeneration(gen)) return;
      setEvents({
        data: response,
        status: 'success',
        statsPending: false,
      });
    } catch (error) {
      if (!isCurrentGeneration(gen)) return;
      setEvents({
        data: [],
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [events.status]);

  const clearEventsCache = useCallback(() => {
    invalidateEventsCache();
    setEvents({
      data: [],
      status: 'idle',
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
      clearEventsCache,
    }),
    [language, theme, themePreference, events, loadEvents, clearEventsCache],
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

