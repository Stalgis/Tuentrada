import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Appearance } from 'react-native';
import { fetchEvents } from '../lib/apiClient.mock';
import type { CurrencyCode, Event, EventMetrics, Language } from '../lib/types';
import type { ThemeName } from '../lib/theme';

type EventsStatus = 'idle' | 'loading' | 'success' | 'error';

type EventsState = {
  data: Event[];
  status: EventsStatus;
  error?: string;
};

type AppState = {
  language: Language;
  currency: CurrencyCode;
  theme: ThemeName;
  events: EventsState;
  setLanguage: (lang: Language) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setTheme: (theme: ThemeName) => void;
  loadEvents: () => Promise<void>;
  clearEventsCache: () => void;
};

const AppStateContext = createContext<AppState | undefined>(undefined);

export const AppStateProvider = ({ children }: PropsWithChildren) => {
  const [language, setLanguage] = useState<Language>('es');
  const [currency, setCurrency] = useState<CurrencyCode>('ARS');
  const [theme, setTheme] = useState<ThemeName>(() => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'));
  const [events, setEvents] = useState<EventsState>({
    data: [],
    status: 'idle',
  });

  const loadEvents = useCallback(async () => {
    if (events.status === 'loading') {
      return;
    }

    setEvents((prev) => ({
      ...prev,
      status: 'loading',
      error: undefined,
    }));

    try {
      const response = await fetchEvents();
      setEvents({
        data: response,
        status: 'success',
      });
    } catch (error) {
      setEvents({
        data: [],
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [events.status]);

  const clearEventsCache = useCallback(() => {
    setEvents({
      data: [],
      status: 'idle',
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      language,
      currency,
      theme,
      events,
      setLanguage,
      setCurrency,
      setTheme,
      loadEvents,
      clearEventsCache,
    }),
    [language, currency, theme, events, loadEvents, clearEventsCache],
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

export const useEventMetrics = (): EventMetrics => {
  const {
    events: { data },
  } = useAppState();

  return useMemo(() => {
    const upcoming = data.filter((event) => new Date(event.dateISO).getTime() > Date.now()).length;
    const ticketsSold = data.reduce((acc, event) => acc + event.ticketsSold, 0);
    const totalRevenueARS = data.reduce((acc, event) => acc + event.ticketsSold * event.ticketPriceARS, 0);
    return { upcoming, ticketsSold, totalRevenueARS };
  }, [data]);
};
