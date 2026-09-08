import type { NotificationDestination } from "./pushPayload";

/**
 * Destino pendiente de una notificación tocada.
 *
 * Vive fuera del árbol de React a propósito. `RootNavigator` monta el stack
 * autenticado con `key={sessionGeneration}`, así que al iniciar sesión todo el
 * árbol se remonta y cualquier estado guardado adentro se pierde. Y ese es
 * justamente el caso más frecuente: `AuthProvider` arranca en
 * `unauthenticated` y no restaura la sesión, por lo que casi todo aviso
 * tocado pasa primero por el login.
 *
 * El destino se consume una sola vez (`takePendingDestination`) para que un
 * remonte posterior no vuelva a abrir el mismo informe.
 */

let pending: NotificationDestination | null = null;
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of [...listeners]) {
    listener();
  }
};

export const setPendingDestination = (destination: NotificationDestination): void => {
  pending = destination;
  notify();
};

export const peekPendingDestination = (): NotificationDestination | null => pending;

/** Devuelve el destino pendiente y lo descarta. */
export const takePendingDestination = (): NotificationDestination | null => {
  const destination = pending;
  pending = null;
  return destination;
};

/**
 * Descarta el destino sin navegar. Se llama al cerrar sesión: un aviso tocado
 * por una cuenta no debe abrirse dentro de la sesión de otra.
 */
export const clearPendingDestination = (): void => {
  if (pending === null) return;
  pending = null;
  notify();
};

/** Avisa cuando aparece un destino con la app ya abierta. */
export const subscribeToPendingDestination = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
