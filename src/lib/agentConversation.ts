/**
 * Identidad del hilo de conversación.
 *
 * El servidor guarda el historial con clave `fingerprintDelToken:conversationId`
 * y valida el id contra `/^[A-Za-z0-9_-]{8,64}$/` antes de tocar nada. Un id
 * que no matchee es un 400 en cada mensaje, así que el formato importa.
 *
 * No hace falta que sea imposible de adivinar: sin el token de esa sesión el id
 * no abre ninguna conversación.
 */
export const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const newConversationId = (): string => {
  const base = Date.now().toString(36);
  const sufijo = Math.random().toString(36).slice(2, 10).padEnd(6, "0");
  return `${base}-${sufijo}`;
};
