import {
  compareEvents,
  comparePeriods,
  getEventStats,
  listEvents,
} from "../../labs/agent-sdk/eventData.mjs";

/**
 * Adaptador temporal. Mantiene los datos ficticios fuera del agente para que
 * después podamos sustituir esta clase por un cliente HTTP real.
 */
export class DemoReportClient {
  listEvents(ownerId) {
    return listEvents(ownerId);
  }

  getEventStats(ownerId, eventName, period) {
    return getEventStats(ownerId, eventName, period);
  }

  compareEvents(ownerId, eventA, eventB, period) {
    return compareEvents(ownerId, eventA, eventB, period);
  }

  comparePeriods(ownerId, eventName) {
    return comparePeriods(ownerId, eventName);
  }
}
