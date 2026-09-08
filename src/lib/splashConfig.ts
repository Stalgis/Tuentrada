/**
 * Lee la configuración del splash desde los plugins del config de Expo.
 *
 * `RootNavigator` dibuja una continuación del splash nativo mientras verifica
 * la sesión, y para que el traspaso no se note tiene que usar exactamente el
 * mismo fondo y el mismo ancho de logo que declara app.json. Tenerlos escritos
 * en los dos lados los deja divergir en silencio: nada falla, sólo vuelve el
 * parpadeo que ese código existe para evitar.
 */

export type SplashConfig = {
  backgroundColor: string;
  imageWidth: number;
};

/** Se usan si el bloque del plugin no está o viene incompleto. */
export const DEFAULT_SPLASH: SplashConfig = {
  backgroundColor: "#021f79",
  imageWidth: 220,
};

const PLUGIN_NAME = "expo-splash-screen";

export const readSplashConfig = (plugins: unknown): SplashConfig => {
  if (!Array.isArray(plugins)) return DEFAULT_SPLASH;

  // Un plugin es `"nombre"` o `["nombre", { ...opciones }]`. Sólo la segunda
  // forma trae configuración.
  const entry = plugins.find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === PLUGIN_NAME,
  );

  const options = entry?.[1];
  if (!options || typeof options !== "object") return DEFAULT_SPLASH;

  const backgroundColor = options.backgroundColor;
  const imageWidth = options.imageWidth;

  return {
    backgroundColor:
      typeof backgroundColor === "string" && backgroundColor.trim() !== ""
        ? backgroundColor
        : DEFAULT_SPLASH.backgroundColor,
    imageWidth:
      typeof imageWidth === "number" && Number.isFinite(imageWidth) && imageWidth > 0
        ? imageWidth
        : DEFAULT_SPLASH.imageWidth,
  };
};
