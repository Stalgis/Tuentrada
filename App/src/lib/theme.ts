import { DefaultTheme, DarkTheme, Theme as NavigationTheme } from '@react-navigation/native';

export const lightPalette = {
  background: '#f5f7fb',
  card: '#ffffff',
  primary: '#007bff',
  text: '#0f172a',
  subtext: '#5b6b7e',
  border: '#d9e3f0',
  muted: '#eef2f7',
  success: '#4CAF50',
  warning: '#ff7043',
};

export const darkPalette = {
  background: '#011a34',
  card: '#042450',
  primary: '#007bff',
  text: '#f8fafc',
  subtext: '#b7c6d8',
  border: '#0b2a52',
  muted: '#04101f',
  success: '#4CAF50',
  warning: '#ff7043',
};

export type AppTheme = typeof lightPalette;
export type ThemeName = 'light' | 'dark';
export type ThemePreference = ThemeName | 'system';

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
