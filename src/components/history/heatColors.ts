import type { ThemeName } from "../../lib/theme";

/**
 * Rampa secuencial de un solo tono para el mapa de calor del calendario.
 *
 * No es un semáforo a propósito. Verde/amarillo/rojo afirma «este día estuvo
 * bien o mal», y sostener esa afirmación exige una meta diaria que el backend
 * no expone. Una rampa de intensidad sólo afirma «más o menos que los otros
 * días del rango», que es lo que los datos sí permiten decir.
 *
 * En claro va de claro a oscuro; en oscuro se invierte, porque sobre fondo
 * negro lo que destaca es lo más luminoso. Ambas son monótonas en luminosidad,
 * que es la propiedad que hace legible una escala secuencial.
 */
const LIGHT_RAMP = ["#e8f0fa", "#c3d6ef", "#8fb2e0", "#4f82c9", "#0b4d9e"] as const;
const DARK_RAMP = ["#1e2e44", "#26507c", "#3474be", "#4a97ff", "#93c2ff"] as const;

export type HeatScale = {
  /** Cinco pasos, del tramo más bajo al más alto. */
  steps: readonly string[];
  /** Color de texto legible sobre cada paso (1..5). */
  inkFor: (bucket: number) => string;
  /** Fondo de un día que el backend no devolvió. */
  empty: string;
};

export const getHeatScale = (theme: ThemeName): HeatScale => {
  const dark = theme === "dark";
  return {
    steps: dark ? DARK_RAMP : LIGHT_RAMP,
    // El contraste se invierte a mitad de la rampa: sobre los dos pasos más
    // saturados el texto oscuro deja de leerse en claro, y el claro en oscuro.
    inkFor: (bucket) =>
      dark
        ? bucket >= 4
          ? "#08182c"
          : "#dbe8fb"
        : bucket >= 4
          ? "#ffffff"
          : "#1c3557",
    empty: dark ? "#1b1b1b" : "#eef0f3",
  };
};
