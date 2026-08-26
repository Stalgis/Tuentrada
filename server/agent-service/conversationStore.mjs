const DEFAULT_TTL_MS = 30 * 60_000;
const DEFAULT_MAX_ITEMS = 40;
const DEFAULT_MAX_CONVERSATIONS = 500;

/**
 * Historial de conversación en memoria del proceso.
 *
 * La clave es `${fingerprintDelToken}:${conversationId}`. El fingerprint no es
 * opcional: si la clave fuera sólo el conversationId, cualquiera podría mandar
 * el id de otro y leer su conversación. El id lo genera el cliente, el
 * fingerprint sale del token ya validado.
 *
 * El historial vive sólo en este proceso: se pierde al reiniciar y no sirve si
 * hay más de una instancia. Para el beta alcanza. Cuando haya varias réplicas
 * esto se muda a Redis sin cambiar la interfaz.
 */
export const createConversationStore = ({
  ttlMs = DEFAULT_TTL_MS,
  maxItems = DEFAULT_MAX_ITEMS,
  maxConversations = DEFAULT_MAX_CONVERSATIONS,
  now = () => Date.now(),
} = {}) => {
  const entries = new Map();

  const prune = (timestamp) => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= timestamp) entries.delete(key);
    }
    // Tope duro por si el pruning por TTL no alcanza. Map itera en orden de
    // inserción y cada `set` reinserta, así que el primero es el más viejo.
    while (entries.size > maxConversations) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
  };

  return {
    key(fingerprint, conversationId) {
      return `${fingerprint}:${conversationId}`;
    },

    get(key) {
      const entry = entries.get(key);
      if (!entry) return [];
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return [];
      }
      return entry.history;
    },

    set(key, history) {
      const timestamp = now();
      // Reinsertar mueve la clave al final del orden de iteración, que es lo
      // que hace que el desalojo por tamaño saque de verdad la más vieja.
      entries.delete(key);
      entries.set(key, { history: trimHistory(history, maxItems), expiresAt: timestamp + ttlMs });
      prune(timestamp);
    },

    delete(key) {
      entries.delete(key);
    },

    get size() {
      return entries.size;
    },

    clear() {
      entries.clear();
    },
  };
};

/**
 * Recorta el historial dejando los últimos `maxItems`, pero moviendo el corte
 * hacia adelante hasta un mensaje del usuario.
 *
 * Cortar en cualquier lado deja un `function_call_result` sin su
 * `function_call`, y la API rechaza esa secuencia. Si no aparece ningún
 * mensaje de usuario dentro de la ventana, se devuelve el historial entero:
 * mejor pagar tokens de más que mandar algo que no se puede procesar.
 */
export const trimHistory = (history, maxItems) => {
  if (!Array.isArray(history) || history.length <= maxItems) return history ?? [];

  const window = history.length - maxItems;
  for (let index = window; index < history.length; index += 1) {
    const item = history[index];
    if (item?.type === "message" && item?.role === "user") {
      return history.slice(index);
    }
    if (item?.role === "user" && item?.type === undefined) {
      return history.slice(index);
    }
  }

  return history;
};
