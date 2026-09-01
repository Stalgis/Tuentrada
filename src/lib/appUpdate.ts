/**
 * Estado del flujo de actualización OTA, derivado de las banderas que expone
 * `Updates.useUpdates()`.
 *
 * Se mantiene puro y sin importar `expo-updates` para poder testearlo en node:
 * las banderas llegan a la vez y varias pueden ser verdaderas al mismo tiempo,
 * así que lo que importa es el orden en que se resuelven.
 */

export type UpdateStatus =
  /** expo-updates no corre en Expo Go ni en desarrollo. */
  | "disabled"
  | "idle"
  | "checking"
  | "downloading"
  | "restarting"
  /** Hay una actualización publicada, falta descargarla. */
  | "available"
  /** Ya descargada: sólo falta reiniciar para aplicarla. */
  | "ready"
  | "upToDate"
  | "error";

export type UpdateFlags = {
  isEnabled: boolean;
  isChecking: boolean;
  isDownloading: boolean;
  isRestarting: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  checkError?: Error | null;
  downloadError?: Error | null;
  /** Si ya hubo al menos una comprobación desde que arrancó la app. */
  hasChecked: boolean;
};

export const getUpdateStatus = (flags: UpdateFlags): UpdateStatus => {
  if (!flags.isEnabled) return "disabled";

  // Los estados en curso mandan sobre todo lo demás: describen lo que está
  // pasando ahora, no el resultado de la vuelta anterior.
  if (flags.isRestarting) return "restarting";
  if (flags.isDownloading) return "downloading";
  if (flags.isChecking) return "checking";

  // Una descarga terminada gana sobre cualquier error viejo: la actualización
  // ya está en el dispositivo y lo único que falta es reiniciar.
  if (flags.isUpdatePending) return "ready";

  if (flags.downloadError) return "error";
  if (flags.isUpdateAvailable) return "available";
  if (flags.checkError) return "error";

  return flags.hasChecked ? "upToDate" : "idle";
};

export type UpdateAction = "check" | "download" | "restart" | "none";

/** Qué hace el botón en cada estado. */
export const nextUpdateAction = (status: UpdateStatus): UpdateAction => {
  switch (status) {
    case "available":
      return "download";
    case "ready":
      return "restart";
    case "idle":
    case "upToDate":
    case "error":
      return "check";
    // Mientras algo está en curso el botón no ofrece acción: repetir la
    // llamada no acelera nada y deja dos descargas compitiendo.
    case "checking":
    case "downloading":
    case "restarting":
    case "disabled":
      return "none";
  }
};

/**
 * Sólo se muestra el bloque cuando expo-updates está activo. En Expo Go y en
 * desarrollo no hay actualizaciones que buscar, y un botón que nunca encuentra
 * nada es peor que no tener botón.
 */
export const shouldShowUpdateSection = (status: UpdateStatus): boolean =>
  status !== "disabled";
