/**
 * Caché de catálogo por sesión, con TTL corto.
 *
 * Motivo: no existe un endpoint liviano para validar la sesión, así que cada
 * mensaje del chat terminaba pidiendo `event-list` completo (una fila por
 * función). En una conversación de varios turnos eso es la misma carga pesada
 * repetida N veces.
 *
 * TRADEOFF EXPLÍCITO: mientras la entrada vive, una sesión revocada sigue
 * pasando la validación. La ventana es el TTL (60s por defecto) y la clave es
 * el fingerprint del token, así que sólo alarga la vida del mismo token que ya
 * había leído esos datos. Poner AGENT_CATALOG_CACHE_TTL_MS=0 desactiva la
 * caché y vuelve a revalidar en cada mensaje.
 *
 * La promesa se comparte entre peticiones concurrentes, por eso el loader
 * nunca debe atarse al AbortSignal de una petición puntual: si esa se cancela,
 * arrastraría a las demás.
 */
export const createCatalogCache = ({ ttlMs = 60_000, now = () => Date.now() } = {}) => {
  const entries = new Map();

  // Se limpia al usar en vez de con un setInterval: sin timer no hay handle
  // colgado que impida cerrar el proceso ni que haya que limpiar en los tests.
  const prune = (timestamp) => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= timestamp) entries.delete(key);
    }
  };

  return {
    resolve(key, loader) {
      if (ttlMs <= 0) return loader();

      const timestamp = now();
      prune(timestamp);

      const hit = entries.get(key);
      if (hit) return hit.promise;

      // Un fallo no se cachea: se borra la entrada para que el siguiente
      // intento vuelva a pegarle al backend.
      const promise = loader().catch((error) => {
        entries.delete(key);
        throw error;
      });

      entries.set(key, { promise, expiresAt: timestamp + ttlMs });
      return promise;
    },
    get size() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
  };
};
