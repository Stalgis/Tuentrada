import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGlobalStats, type StatsData } from "../lib/apiClient";
import {
  runIndependentRequests,
  type IndependentRequest,
} from "../lib/independentRequests";
import { currentGeneration, isCurrentGeneration } from "../lib/session";

type PeriodKey = "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth";

/** Valores de `date` que entiende /report/stats, por período. */
const PERIODS: Record<PeriodKey, string> = {
  thisWeek: "this_week",
  lastWeek: "last_week",
  thisMonth: "this_month",
  lastMonth: "last_month",
};

const PERIOD_KEYS = Object.keys(PERIODS) as PeriodKey[];

type GlobalStatsState = { [K in PeriodKey]: StatsData | null } & {
  [K in PeriodKey as `${K}Loading`]: boolean;
} & { [K in PeriodKey as `${K}Error`]: string | null } & {
  lastUpdated: Date | null;
};

const initialState: GlobalStatsState = {
  thisWeek: null,
  lastWeek: null,
  thisMonth: null,
  lastMonth: null,
  thisWeekLoading: false,
  lastWeekLoading: false,
  thisMonthLoading: false,
  lastMonthLoading: false,
  thisWeekError: null,
  lastWeekError: null,
  thisMonthError: null,
  lastMonthError: null,
  lastUpdated: null,
};

const errorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "No se pudieron cargar las estadísticas";

export const useGlobalStats = (accessToken?: string) => {
  const [state, setState] = useState<GlobalStatsState>(initialState);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!accessToken) return;

    const requestId = ++requestIdRef.current;
    const generation = currentGeneration();
    const isActive = () =>
      requestIdRef.current === requestId && isCurrentGeneration(generation);

    setState((prev) => {
      const next = { ...prev };
      for (const key of PERIOD_KEYS) {
        next[`${key}Loading`] = true;
        next[`${key}Error`] = null;
      }
      return next;
    });

    // Cada período es independiente: que uno falle o tarde no debe impedir que
    // los demás se muestren apenas llegan.
    const requests: IndependentRequest<StatsData>[] = PERIOD_KEYS.map((key) => ({
      run: () => fetchGlobalStats(accessToken, PERIODS[key]),
      onSuccess: (data) => {
        if (!isActive()) return;
        setState((prev) => ({
          ...prev,
          [key]: data,
          [`${key}Error`]: null,
          lastUpdated: new Date(),
        }));
      },
      onError: (error) => {
        if (!isActive()) return;
        setState((prev) => ({ ...prev, [`${key}Error`]: errorMessage(error) }));
      },
      onSettled: () => {
        if (!isActive()) return;
        setState((prev) => ({ ...prev, [`${key}Loading`]: false }));
      },
    }));

    await runIndependentRequests<StatsData>(requests);
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
