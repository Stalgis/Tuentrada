/**
 * Formateo de la versión que se muestra en Perfil.
 *
 * Se mantiene puro y sin importar `expo-constants` para poder testearlo en
 * node; la lectura de los valores del binario vive en `useAppVersion`.
 */

export type VersionSource = {
  /** Versión de marketing (`expo.version` de app.json). La que ve la tienda. */
  version?: string | null;
  /**
   * Número de build del binario: `CFBundleVersion` en iOS, `versionCode` en
   * Android. No sale de app.json — con `appVersionSource: "remote"` en
   * eas.json el valor de app.json queda congelado en 1 mientras EAS lo
   * incrementa en cada build, así que hay que leerlo del binario.
   */
  buildNumber?: string | number | null;
  /** En Expo Go el binario es el de Expo, no el de la app. */
  isExpoGo?: boolean;
};

export const UNKNOWN_VERSION = "desconocida";

const hasBuildNumber = (value: VersionSource["buildNumber"]): boolean => {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return value.trim() !== "";
};

/**
 * Devuelve `"1.2.2 (47)"`, `"1.2.2"` si no hay build, o `"1.2.2 · Expo Go"`
 * cuando corre dentro de Expo Go, donde el número de build pertenece a Expo y
 * mostrarlo sería mentir sobre qué binario tiene el usuario.
 */
export const formatAppVersion = (source: VersionSource): string => {
  const version = source.version?.trim();
  if (!version) return UNKNOWN_VERSION;
  if (source.isExpoGo) return `${version} · Expo Go`;
  if (!hasBuildNumber(source.buildNumber)) return version;
  return `${version} (${String(source.buildNumber).trim()})`;
};
