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

// `getLastNotificationResponseAsync` sigue devolviendo la última respuesta en
// arranques posteriores. Sin esta guarda, reabrir la app volvería a empujar al
// usuario al mismo informe.
const handledResponses = new Set<string>();

const handleResponse = (response: Notifications.NotificationResponse | null): void => {
  if (!response) return;

  const identifier = response.notification.request.identifier;
  if (identifier) {
    if (handledResponses.has(identifier)) return;
    handledResponses.add(identifier);
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

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
};
