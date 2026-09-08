import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { setPendingDestination } from "../lib/pendingNotification";
import { parseNotificationDestination } from "../lib/pushPayload";

/**
 * Escucha los avisos tocados y deja el destino en el store de pendientes.
 *
 * Se monta por encima del gate de autenticación: el arranque en frío —app
 * cerrada, el usuario toca la notificación— tiene que capturarse antes de que
 * exista sesión, porque `AuthProvider` empieza en `unauthenticated`.
 */

// Guarda dentro del proceso: el listener y el arranque en frío pueden entregar
// la misma respuesta.
const handledResponses = new Set<string>();

const handleResponse = (response: Notifications.NotificationResponse | null): void => {
  if (!response) return;

  const identifier = response.notification.request.identifier;
  if (identifier) {
    if (handledResponses.has(identifier)) return;
    handledResponses.add(identifier);
  }

  // El Set vive en memoria y muere con el proceso, que es justo cuando
  // `getLastNotificationResponseAsync` sigue devolviendo la última respuesta:
  // sin esto, cada arranque posterior volvería a empujar al usuario al mismo
  // informe. Se limpia en el nativo apenas la tomamos.
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    // Entorno sin el módulo: la guarda en memoria alcanza para esta sesión.
  }

  const destination = parseNotificationDestination(
    response.notification.request.content.data,
  );
  if (!destination) return;

  setPendingDestination(destination);
};

export const useNotificationResponses = (): void => {
  useEffect(() => {
    let cancelled = false;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled) return;
        handleResponse(response);
      })
      .catch(() => {
        // Sin respuesta previa o entorno sin soporte: no hay nada que abrir.
      });

    // Este hook envuelve toda la app: si registrar el listener tira —Expo Go en
    // Android ya no trae el módulo de push— no puede llevarse puesto el render.
    let subscription: Notifications.EventSubscription | null = null;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    } catch {
      // Entorno sin soporte: la app funciona, sólo no enruta desde un aviso.
    }

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);
};
