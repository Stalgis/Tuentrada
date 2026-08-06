import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGlobalStats, type StatsData } from "../lib/apiClient";
import { currentGeneration, isCurrentGeneration } from "../lib/session";

type GlobalStatsState = {
  thisMonth: StatsData | null;
  lastMonth: StatsData | null;
  thisMonthLoading: boolean;
  lastMonthLoading: boolean;
  thisMonthError: string | null;
  lastMonthError: string | null;
  lastUpdated: Date | null;
};

const initialState: GlobalStatsState = {
  thisMonth: null,
  lastMonth: null,
  thisMonthLoading: false,
  lastMonthLoading: false,
  thisMonthError: null,
  lastMonthError: null,
  lastUpdated: null,
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "No se pudieron cargar las estadísticas";

export const useGlobalStats = (accessToken?: string) => {
  const [state, setState] = useState<GlobalStatsState>(initialState);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!accessToken) return;

    const requestId = ++requestIdRef.current;
    const generation = currentGeneration();
    const isActive = () =>
      requestIdRef.current === requestId && isCurrentGeneration(generation);

    setState((prev) => ({
      ...prev,
      thisMonthLoading: true,
      lastMonthLoading: true,
      thisMonthError: null,
      lastMonthError: null,
    }));

    const thisMonthRequest = fetchGlobalStats(accessToken, "this_month")
      .then((data) => {
        if (!isActive()) return;
        setState((prev) => ({
          ...prev,
          thisMonth: data,
          thisMonthError: null,
          lastUpdated: new Date(),
        }));
      })
      .catch((error) => {
        if (!isActive()) return;
        setState((prev) => ({ ...prev, thisMonthError: errorMessage(error) }));
      })
      .finally(() => {
        if (!isActive()) return;
        setState((prev) => ({ ...prev, thisMonthLoading: false }));
      });

    const lastMonthRequest = fetchGlobalStats(accessToken, "last_month")
      .then((data) => {
        if (!isActive()) return;
        setState((prev) => ({ ...prev, lastMonth: data, lastMonthError: null }));
      })
      .catch((error) => {
        if (!isActive()) return;
        setState((prev) => ({ ...prev, lastMonthError: errorMessage(error) }));
      })
      .finally(() => {
        if (!isActive()) return;
        setState((prev) => ({ ...prev, lastMonthLoading: false }));
      });

    await Promise.allSettled([thisMonthRequest, lastMonthRequest]);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      requestIdRef.current += 1;
      setState(initialState);
      return;
    }

    load();
  }, [accessToken, load]);

  return { ...state, retry: load };
};
