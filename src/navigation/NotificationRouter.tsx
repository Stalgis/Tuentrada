import { useEffect } from "react";
import { createNavigationContainerRef } from "@react-navigation/native";
import {
  subscribeToPendingDestination,
  takePendingDestination,
} from "../lib/pendingNotification";
import type { AppStackParamList } from "./types";

export const navigationRef = createNavigationContainerRef<AppStackParamList>();

/**
 * Lleva al informe el destino dejado por una notificación tocada.
 *
 * Se monta dentro del stack autenticado a propósito: mientras no haya sesión,
 * la ruta `Report` no existe y consumir el destino lo perdería. Al montarse
 * cubre el caso de "aviso tocado y después login"; la suscripción cubre el de
 * "aviso tocado con la app abierta".
 */
const NotificationRouter = () => {
  useEffect(() => {
    const flush = () => {
      if (!navigationRef.isReady()) return;
      const destination = takePendingDestination();
      if (!destination) return;
      navigationRef.navigate("Report", destination);
    };

    // Un tick de gracia: en el primer montaje el contenedor puede no haber
    // terminado de publicar su estado, y navegar antes de eso no hace nada.
    const timer = setTimeout(flush, 0);
    const unsubscribe = subscribeToPendingDestination(flush);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return null;
};

export default NotificationRouter;
