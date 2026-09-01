import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * `true` cuando la app corre dentro de Expo Go y no como binario propio.
 *
 * Vive acá y no repetido en cada archivo porque la comprobación cambió de API:
 * `Constants.appOwnership` quedó deprecado en favor de `executionEnvironment`,
 * y tenerla en un solo lugar evita que la próxima migración vuelva a dejar una
 * copia atrás.
 *
 * `StoreClient` es exactamente Expo Go; los otros valores del enum son `bare`
 * (dev build) y `standalone` (build de tienda), donde el binario sí es el de
 * la app.
 */
export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
