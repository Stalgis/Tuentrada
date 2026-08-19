import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGlobalStats, type StatsData } from "../lib/apiClient";
import {
  runIndependentRequests,
  type IndependentRequest,
} from "../lib/independentRequests";
import { currentGeneration, isCurrentGeneration } from "../lib/session";

export type PeriodKey = "all" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth";
export const DASHBOARD_PERIODS = ["all"] as const;
export const MONTH_PERIODS = ["thisMonth", "lastMonth"] as const;

/** Valores de `date` que entiende /report/stats, por período. */
const PERIODS: Record<PeriodKey, string> = {
  all: "all",
  thisWeek: "this_week",
  lastWeek: "last_week",
  thisMonth: "this_month",
  lastMonth: "last_month",
};

type GlobalStatsState = { [K in PeriodKey]: StatsData | null } & {
  [K in PeriodKey as `${K}Loading`]: boolean;
} & { [K in PeriodKey as `${K}Error`]: string | null } & {
  lastUpdated: Date | null;
};

const initialState: GlobalStatsState = {
  all: null,
  thisWeek: null,
  lastWeek: null,
  thisMonth: null,
  lastMonth: null,
  allLoading: false,
  thisWeekLoading: false,
  lastWeekLoading: false,
  thisMonthLoading: false,
  lastMonthLoading: false,
  allError: null,
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

export const useGlobalStats = (
  accessToken?: string,
  periodKeys: readonly PeriodKey[] = MONTH_PERIODS,
  eventIds: readonly string[] = [],
) => {
  const [state, setState] = useState<GlobalStatsState>(initialState);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!accessToken || eventIds.length === 0) return;

    const requestId = ++requestIdRef.current;
    const generation = currentGeneration();
    const isActive = () =>
      requestIdRef.current === requestId && isCurrentGeneration(generation);

    setState((prev) => {
      const next = { ...prev };
      for (const key of periodKeys) {
        next[`${key}Loading`] = true;
        next[`${key}Error`] = null;
      }
      return next;
    });

    // Cada período es independiente: que uno falle o tarde no debe impedir que
    // los demás se muestren apenas llegan.
    const requests: IndependentRequest<StatsData>[] = periodKeys.map((key) => ({
      run: () => fetchGlobalStats(accessToken, [...eventIds], PERIODS[key]),
      onSuccess: (data) => {
        if (!isActive()) return;
        setState((prev) => ({
          ...prev,
          [key]: data,
          [`${key}Error`]: null,
          lastUpdated: key === periodKeys[0] ? new Date() : prev.lastUpdated,
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
  }, [accessToken, eventIds, periodKeys]);

  useEffect(() => {
    if (!accessToken || eventIds.length === 0) {
      requestIdRef.current += 1;
      setState(initialState);
      return;
    }

    load();
  }, [accessToken, eventIds.length, load]);

  return { ...state, retry: load };
};
