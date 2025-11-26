import { DefaultTheme, Theme as NavigationTheme } from '@react-navigation/native';

export const lightPalette = {
  background: '#f8fafc',
  card: '#ffffff',
  primary: '#0f5cff',
  text: '#0f172a',
  subtext: '#475569',
  border: '#e2e8f0',
  muted: '#f1f5f9',
  success: '#16a34a',
  warning: '#eab308',
};

export type AppTheme = typeof lightPalette;

export const lightTheme: AppTheme = lightPalette;

export const navigationTheme: NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: lightPalette.background,
    card: lightPalette.card,
    border: lightPalette.border,
    primary: lightPalette.primary,
    text: lightPalette.text,
  },
};
