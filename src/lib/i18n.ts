import { Language } from "./types";

export const translations = {
  en: {
    loginTitle: "Welcome back",
    loginSubtitle: "Enter your credentials to continue.",
    emailLabel: "Email",
    passwordLabel: "Password",
    loginButton: "Sign in",
    loginMissingFields: "Enter your email and password.",
    loginGenericError: "We could not sign you in. Try again.",
    faceIdDisable: "Disable biometrics",
    securityTitle: "Security",
    securityBody:
      "Use biometrics for faster access after enabling it from a successful login.",
    signOut: "Sign out",
    signOutConfirmTitle: "Sign out",
    signOutConfirmMessage: "Are you sure you want to sign out?",
    signOutConfirmCancel: "Cancel",
    appVersionLabel: "Version",
  },
  es: {
    loginTitle: "Bienvenido de nuevo",
    loginSubtitle: "Ingresá con tus credenciales para continuar.",
    emailLabel: "Email",
    passwordLabel: "Contraseña",
    loginButton: "Iniciar sesión",
    loginMissingFields: "Ingresá usuario y contraseña.",
    loginGenericError: "No pudimos iniciar sesión. Intentá nuevamente.",
    faceIdDisable: "Desactivar biometría",
    securityTitle: "Seguridad",
    securityBody:
      "Usá biometría para un acceso más rápido después de activarla desde un login exitoso.",
    signOut: "Cerrar sesión",
    signOutConfirmTitle: "Cerrar sesión",
    signOutConfirmMessage: "¿Estás seguro que querés cerrar sesión?",
    signOutConfirmCancel: "Cancelar",
    appVersionLabel: "Versión",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export const getTranslation = (language: Language, key: TranslationKey) =>
  translations[language][key];
