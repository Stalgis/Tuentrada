import { useMemo } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { formatAppVersion } from "../lib/appVersion";
import { IS_EXPO_GO } from "../lib/expoRuntime";

/**
 * Versión que corre en el dispositivo, lista para mostrar.
 *
 * La versión de marketing sale de `expoConfig`, pero el número de build se lee
 * del binario (`Constants.platform`) y no de `expoConfig.ios.buildNumber`: con
 * `appVersionSource: "remote"` en eas.json, EAS incrementa el build en sus
 * servidores y el valor de app.json queda clavado en 1.
 */
export const useAppVersion = (): string =>
  useMemo(() => {
    const buildNumber =
      Platform.OS === "ios"
        ? Constants.platform?.ios?.buildNumber
        : Constants.platform?.android?.versionCode;

    return formatAppVersion({
      version: Constants.expoConfig?.version,
      buildNumber,
      isExpoGo: IS_EXPO_GO,
    });
  }, []);
