import {
  DarkTheme,
  DefaultTheme,
  Theme as NavigationTheme,
} from "@react-navigation/native";

export const lightPalette = {
  background: "#f7f9fb",
  surface: "#ffffff",
  surfaceMuted: "#f2f4f6",
  // Superficie que se hunde por debajo de la base, para que las tarjetas que
  // van encima se lean como objetos. En claro `background` dejaba la burbuja
  // del chat en 1,06 contra su fondo, la mitad de lo que usan iMessage (1,21)
  // o WhatsApp (1,20); con este tono queda en 1,16.
  surfaceSunken: "#eceef0",
  surfaceEmphasis: "#e8f1ff",
  card: "#ffffff",
  primary: "#0058bc",
  // Texto e iconos sobre `primary`. En claro el blanco da 6,73:1; en oscuro
  // daba 3,16:1, por debajo del 4,5:1 que pide WCAG AA para texto normal.
  onPrimary: "#ffffff",
  primarySoft: "#d8e2ff",
  secondary: "#405e96",
  text: "#191c1e",
  subtext: "#5d6472",
  border: "#d9dee7",
  hairline: "rgba(113,119,134,0.16)",
  muted: "#eceef0",
  success: "#37b26c",
  warning: "#f2a640",
  danger: "#e56b6f",
};

export const darkPalette = {
  background: "#131313",
  surface: "#201f1f",
  surfaceMuted: "#2a2a2a",
  // En oscuro la relación se invierte: la superficie que sube es la más clara,
  // así que hundir el fondo es dejarlo en el negro base. Bajar a `muted`
  // acercaba el fondo a la burbuja y empeoraba la separación (1,13 -> 1,05).
  surfaceSunken: "#131313",
  surfaceEmphasis: "#1a2a40",
  card: "#201f1f",
  primary: "#3e90ff",
  // Azul claro sobre azul: el contraste se consigue oscureciendo el texto,
  // no aclarándolo. 5,55:1 sobre#3e90ff.
  onPrimary: "#0a1a2b",
  primarySoft: "#264778",
  secondary: "#aac7ff",
  text: "#e5e2e1",
  subtext: "#aeb5c0",
  border: "#353534",
  hairline: "rgba(139,145,160,0.18)",
  muted: "#1c1b1b",
  success: "#5fd48e",
  warning: "#ffb55f",
  danger: "#ff8e8e",
};

export type AppTheme = typeof lightPalette;
export type ThemeName = "light" | "dark";
export type ThemePreference = ThemeName | "system";

export const lightTheme: AppTheme = lightPalette;
export const darkTheme: AppTheme = darkPalette;
export const getPalette = (theme: ThemeName): AppTheme =>
  theme === "dark" ? darkPalette : lightPalette;

export const getNavigationTheme = (theme: ThemeName): NavigationTheme =>
  theme === "dark"
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: darkPalette.background,
          card: darkPalette.card,
          border: darkPalette.border,
          primary: darkPalette.primary,
          text: darkPalette.text,
          notification: darkPalette.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: lightPalette.background,
          card: lightPalette.card,
          border: lightPalette.border,
          primary: lightPalette.primary,
          text: lightPalette.text,
          notification: lightPalette.primary,
        },
      };
