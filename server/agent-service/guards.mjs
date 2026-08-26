export class RateLimitError extends Error {
  constructor(retryAfterSeconds) {
    super("Alcanzaste el límite de consultas por hora. Probá de nuevo más tarde.");
    this.name = "RateLimitError";
    this.httpStatus = 429;
    this.publicMessage = this.message;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OverloadedError extends Error {
  constructor() {
    super("El agente está atendiendo demasiadas consultas. Probá en unos segundos.");
    this.name = "OverloadedError";
    this.httpStatus = 503;
    this.publicMessage = this.message;
  }
}

export class BudgetExhaustedError extends Error {
  constructor() {
    super("El agente alcanzó su cupo diario. Vuelve a estar disponible mañana.");
    this.name = "BudgetExhaustedError";
    this.httpStatus = 503;
    this.publicMessage = this.message;
  }
}

const utcDay = (timestamp) => Math.floor(timestamp / 86_400_000);

/**
 * Tres topes, en orden de qué protegen:
 *
 * 1. Presupuesto diario de tokens. Protege contra un bug propio (un loop de
 *    tools, un prompt que crece sin control). Es el más importante: el abuso
 *    externo es hipotético, un bug propio no.
 * 2. Límite por sesión. Protege contra una sesión que consulta sin parar.
 * 3. Concurrencia global. Protege contra un pico que dispare el gasto de golpe.
 *
 * Todo el estado vive en memoria del proceso. Con varias réplicas cada una
 * aplica su propia porción; el presupuesto hay que dividirlo entre instancias.
 */
export const createGuards = ({
  maxPerWindow = 30,
  windowMs = 3_600_000,
  maxConcurrent = 4,
  maxGlobalPerWindow = maxPerWindow * maxConcurrent,
  dailyTokenBudget = 0,
  now = () => Date.now(),
} = {}) => {
  const hits = new Map();
  let globalHits = [];
  let inFlight = 0;
  let budgetDay = utcDay(now());
  let tokensToday = 0;

  const rollBudgetDay = (timestamp) => {
    const day = utcDay(timestamp);
    if (day !== budgetDay) {
      budgetDay = day;
      tokensToday = 0;
    }
  };

  return {
    /** Presupuesto y concurrencia se aplican antes de autenticar o tocar reportes. */
    acquireGlobal() {
      const timestamp = now();
      rollBudgetDay(timestamp);

      if (dailyTokenBudget > 0 && tokensToday >= dailyTokenBudget) {
        throw new BudgetExhaustedError();
      }

      globalHits = globalHits.filter((entry) => timestamp - entry < windowMs);
      if (globalHits.length >= maxGlobalPerWindow) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((windowMs - (timestamp - globalHits[0])) / 1000),
        );
        throw new RateLimitError(retryAfterSeconds);
      }

      if (inFlight >= maxConcurrent) throw new OverloadedError();

      globalHits.push(timestamp);
      inFlight += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        inFlight -= 1;
      };
    },

    /** El límite por sesión necesita el fingerprint, disponible tras autenticar. */
    acquireSession(key) {
      const timestamp = now();

      const recent = (hits.get(key) ?? []).filter(
        (entry) => timestamp - entry < windowMs,
      );
      if (recent.length >= maxPerWindow) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((windowMs - (timestamp - recent[0])) / 1000),
        );
        hits.set(key, recent);
        throw new RateLimitError(retryAfterSeconds);
      }

      recent.push(timestamp);
      hits.set(key, recent);

      // Las claves de sesiones inactivas se limpian al pasar, sin timers.
      if (hits.size > 1_000) {
        for (const [entryKey, timestamps] of hits) {
          if (!timestamps.some((entry) => timestamp - entry < windowMs)) {
            hits.delete(entryKey);
          }
        }
      }

    },

    /** Compatibilidad para llamadores que todavía hacen ambas admisiones juntas. */
    acquire(key) {
      const release = this.acquireGlobal();
      try {
        this.acquireSession(key);
        return release;
      } catch (error) {
        release();
        throw error;
      }
    },

    recordUsage(totalTokens) {
      if (!Number.isFinite(totalTokens) || totalTokens <= 0) return;
      rollBudgetDay(now());
      tokensToday += totalTokens;
    },

    stats() {
      rollBudgetDay(now());
      return {
        inFlight,
        tokensToday,
        dailyTokenBudget,
        trackedSessions: hits.size,
      };
    },
  };
};
