import { DefaultTheme, DarkTheme, Theme as NavigationTheme } from '@react-navigation/native';

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

export const darkPalette = {
  background: '#0f172a',
  card: '#0b1220',
  primary: '#4f8bff',
  text: '#e2e8f0',
  subtext: '#94a3b8',
  border: '#1e293b',
  muted: '#111827',
  success: '#22c55e',
  warning: '#f59e0b',
};

export type AppTheme = typeof lightPalette;
export type ThemeName = 'light' | 'dark';

export const lightTheme: AppTheme = lightPalette;
export const darkTheme: AppTheme = darkPalette;
export const getPalette = (theme: ThemeName): AppTheme => (theme === 'dark' ? darkPalette : lightPalette);

export const getNavigationTheme = (theme: ThemeName): NavigationTheme =>
  theme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: darkPalette.background,
          card: darkPalette.card,
          border: darkPalette.border,
          primary: darkPalette.primary,
          text: darkPalette.text,
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
        },
      };
