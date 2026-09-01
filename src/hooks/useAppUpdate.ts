import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Updates from "expo-updates";
import {
  getUpdateStatus,
  nextUpdateAction,
  type UpdateStatus,
} from "../lib/appUpdate";

export type AppUpdate = {
  status: UpdateStatus;
  error: Error | null;
  /** 0..1 mientras descarga, `null` si el servidor no manda Content-Length. */
  progress: number | null;
  /** Ejecuta lo que corresponda al estado actual: buscar, descargar o reiniciar. */
  run: () => Promise<void>;
};

export const useAppUpdate = (): AppUpdate => {
  const {
    isChecking,
    isDownloading,
    isRestarting,
    isUpdateAvailable,
    isUpdatePending,
    checkError,
    downloadError,
    downloadProgress,
    lastCheckForUpdateTimeSinceRestart,
  } = Updates.useUpdates();

  // `reloadAsync` no reporta por `useUpdates`, así que sus fallos se guardan
  // acá. Van en su propia ranura y no mezclados con `downloadError`: significan
  // otra cosa —la actualización está bajada y lo que falló fue aplicarla— y
  // confundirlos deja el mensaje sin mostrar.
  const [restartError, setRestartError] = useState<Error | null>(null);

  const status = getUpdateStatus({
    // En web el módulo trae un stub con `isEnabled` en true que no actualiza
    // nada; sin este filtro la sección aparecería en el build web sin servir.
    isEnabled: Platform.OS !== "web" && Updates.isEnabled,
    isChecking,
    isDownloading,
    isRestarting,
    isUpdateAvailable,
    isUpdatePending,
    checkError,
    downloadError,
    restartError,
    hasChecked: lastCheckForUpdateTimeSinceRestart != null,
  });

  const run = useCallback(async () => {
    setRestartError(null);
    try {
      switch (nextUpdateAction(status)) {
        case "check":
          await Updates.checkForUpdateAsync();
          break;
        case "download":
          await Updates.fetchUpdateAsync();
          break;
        case "restart":
          await Updates.reloadAsync();
          break;
        case "none":
          break;
      }
    } catch (error) {
      setRestartError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [status]);

  // Una comprobación al abrir la pantalla. `checkAutomatically` está en
  // ON_ERROR_RECOVERY para no demorar el arranque de la app, así que este es el
  // momento en que se busca: el usuario entró a Perfil, puede esperar un
  // segundo, y así el botón sólo aparece cuando hay algo para hacer.
  const checkedOnMount = useRef(false);
  useEffect(() => {
    if (checkedOnMount.current || status !== "idle") return;
    checkedOnMount.current = true;
    Updates.checkForUpdateAsync().catch(() => {
      // El error ya viaja por `checkError`; acá sólo se evita el rechazo suelto.
    });
  }, [status]);

  return {
    status,
    error: restartError ?? downloadError ?? checkError ?? null,
    progress: typeof downloadProgress === "number" ? downloadProgress : null,
    run,
  };
};
