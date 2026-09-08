import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

/**
 * Capa fina sobre `expo-notifications`: permisos, canales de Android y token.
 *
 * Todo lo que decide *si* se envía vive en el backend. Acá sólo se resuelve lo
 * que únicamente el teléfono puede resolver.
 */

const IS_EXPO_GO = Constants.appOwnership === "expo";

export type PermissionState = "granted" | "denied" | "undetermined";

/** Categorías del MVP. Un canal por categoría para que Android permita
 * silenciar una sin perder la otra. */
export const ANDROID_CHANNELS = {
  functionReports: "event-reports",
  weeklySummary: "weekly-reports",
} as const;

/**
 * En SDK 54 las push remotas de Android no funcionan en Expo Go: hace falta un
 * development build. Se detecta acá para poder explicarlo en la UI en vez de
 * fallar con un error críptico al pedir el token.
 */
export const isPushSupported = (): boolean =>
  !IS_EXPO_GO && (Platform.OS === "ios" || Platform.OS === "android");

export const pushUnsupportedReason = (): string | undefined => {
  if (IS_EXPO_GO) {
    return "En Expo Go no se pueden probar las notificaciones push. Necesitás un development build.";
  }
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return "Las notificaciones push sólo están disponibles en iOS y Android.";
  }
  return undefined;
};

/**
 * Con la app en primer plano mostramos el aviso igual: el usuario puede estar
 * en otra pantalla y el informe recién generado no es interrumpible de otra
 * forma. Sin sonido ni badge, que son ruido para un informe.
 */
export const configureForegroundHandler = (): void => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
};

export const ensureAndroidChannels = async (): Promise<void> => {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.functionReports, {
    name: "Informes de funciones",
    description: "Aviso cuando el informe de una función queda listo.",
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.weeklySummary, {
    name: "Resumen semanal",
    description: "Aviso cuando el resumen de la semana anterior queda listo.",
    importance: Notifications.AndroidImportance.LOW,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
};

const toPermissionState = (
  permissions: Notifications.NotificationPermissionsStatus,
): PermissionState => {
  if (permissions.granted) return "granted";
  // `canAskAgain` distingue el rechazo definitivo de la primera vez: sólo el
  // primero manda al usuario a los ajustes del sistema.
  return permissions.canAskAgain ? "undetermined" : "denied";
};

export const getPermissionState = async (): Promise<PermissionState> => {
  if (!isPushSupported()) return "denied";
  return toPermissionState(await Notifications.getPermissionsAsync());
};

/**
 * Pide el permiso del sistema. Sólo se llama después de que el usuario activó
 * una categoría: iOS permite preguntar una vez y no queremos gastarla en un
 * arranque frío.
 */
export const requestPermission = async (): Promise<PermissionState> => {
  if (!isPushSupported()) return "denied";

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  if (!current.canAskAgain) return "denied";

  return toPermissionState(
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false,
      },
    }),
  );
};

const projectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export class PushTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushTokenError";
  }
}

export const getExpoPushToken = async (): Promise<string> => {
  const id = projectId();
  if (!id) {
    throw new PushTokenError("Falta el projectId de EAS en la configuración de la app.");
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return token.data;
  } catch (error) {
    // El caso más común en desarrollo: simulador de iOS, que no tiene APNs.
    throw new PushTokenError(
      error instanceof Error && error.message
        ? `No se pudo obtener el token de este dispositivo. ${error.message}`
        : "No se pudo obtener el token de este dispositivo.",
    );
  }
};

/** Abre los ajustes del sistema para la app: única salida tras un rechazo. */
export const openSystemSettings = async (): Promise<void> => {
  await Linking.openSettings();
};
