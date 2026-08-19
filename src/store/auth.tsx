import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import type { PropsWithChildren } from "react";
import {
  authApi,
  AuthCredentialsError,
  PasswordManagedByProviderError,
  type AuthTokens,
} from "../lib/authApi";
import { clearAllCaches } from "../lib/apiClient";
import { logoutApi, setOnUnauthorized } from "../lib/reportApi";
import { bumpGeneration, currentGeneration, isCurrentGeneration } from "../lib/session";
import type { User } from "../lib/types";

export type AuthStatus = "checking" | "unauthenticated" | "authenticated";

/**
 * Motivo del cierre de sesión. Determina la política biométrica:
 * solo el cierre manual borra las credenciales guardadas.
 */
export type SessionEndReason = "user" | "expired" | "unauthorized";

type AuthContextValue = {
  status: AuthStatus;
  user?: User;
  accessToken?: string;
  /** Cambia en cada inicio y cierre de sesión; usarla como `key` para remontar. */
  sessionGeneration: number;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  shouldPromptBiometricEnrollment: boolean;
  sessionExpired: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithBiometric: () => Promise<void>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  dismissBiometricEnrollmentPrompt: () => void;
};

type StoredBiometricCredentials = {
  email: string;
  password: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_BYPASS_ENABLED = false;
const AUTH_BYPASS_USER: User = {
  id: "dev-bypass",
  name: "Dashboard Preview",
  initials: "DP",
  email: "bypass@tuentrada.com",
};
const AUTH_BYPASS_CONTEXT: AuthContextValue = {
  status: "authenticated",
  user: AUTH_BYPASS_USER,
  accessToken: "dev-bypass",
  sessionGeneration: 0,
  biometricEnabled: false,
  biometricAvailable: false,
  shouldPromptBiometricEnrollment: false,
  sessionExpired: false,
  loading: false,
  login: async () => {},
  loginWithBiometric: async () => {},
  logout: async () => {},
  enableBiometric: async () => false,
  disableBiometric: async () => {},
  dismissBiometricEnrollmentPrompt: () => {},
};

const BIOMETRIC_FLAG_KEY = "tuentrada_biometric_enabled";
const BIOMETRIC_CREDENTIALS_KEY = "tuentrada_biometric_credentials";
const IS_EXPO_GO = Constants.appOwnership === "expo";

const BIOMETRIC_PROMPT_MESSAGES = {
  promptMessage: Platform.OS === "ios" ? "Confirmá con Face ID" : "Confirmá con biometría",
  cancelLabel: "Cancelar",
  fallbackLabel: "Usar código",
};

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const isCredentialsPayload = (value: unknown): value is StoredBiometricCredentials => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.email === "string" && typeof candidate.password === "string";
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<User | undefined>(undefined);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [shouldPromptBiometricEnrollment, setShouldPromptBiometricEnrollment] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionGeneration, setSessionGeneration] = useState(() => currentGeneration());
  const pendingCredentialsRef = useRef<StoredBiometricCredentials | null>(null);
  // Lock de cierre atado a la generación: no se libera en un `finally` (eso
  // permitiría que un timer viejo volviera a disparar el cierre), sino que deja
  // de aplicar cuando arranca una sesión nueva.
  const endingGenerationRef = useRef<number | null>(null);

  const clearBiometricStorage = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(BIOMETRIC_FLAG_KEY),
      SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY),
    ]);
    setBiometricEnabled(false);
  }, []);

  const getBiometricAvailability = useCallback(async () => {
    if (IS_EXPO_GO) {
      return false;
    }

    try {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  }, []);

  const promptBiometric = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: BIOMETRIC_PROMPT_MESSAGES.promptMessage,
      cancelLabel: BIOMETRIC_PROMPT_MESSAGES.cancelLabel,
      fallbackLabel: BIOMETRIC_PROMPT_MESSAGES.fallbackLabel,
      biometricsSecurityLevel: "strong",
      disableDeviceFallback: false,
    });

    if (!result.success) {
      throw new Error(result.error ?? "BIOMETRIC_AUTH_FAILED");
    }
  }, []);

  const persistBiometricCredentials = useCallback(async (credentials: StoredBiometricCredentials) => {
    await SecureStore.setItemAsync(
      BIOMETRIC_CREDENTIALS_KEY,
      JSON.stringify(credentials),
      secureStoreOptions,
    );
    await SecureStore.setItemAsync(BIOMETRIC_FLAG_KEY, "true");
    setBiometricEnabled(true);
  }, []);

  const readBiometricCredentials = useCallback(async () => {
    const payload = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY, secureStoreOptions);
    if (!payload) {
      return null;
    }

    try {
      const parsed = JSON.parse(payload) as unknown;
      return isCredentialsPayload(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Único punto de entrada a una sesión autenticada. Invalida la generación
   * anterior y limpia cachés antes de publicar el token nuevo, de modo que
   * ninguna respuesta en vuelo de la sesión previa pueda escribir después.
   */
  const startSession = useCallback(
    ({ tokens, nextUser }: { tokens: AuthTokens; nextUser: User }) => {
      const gen = bumpGeneration();
      clearAllCaches();
      endingGenerationRef.current = null;
      setSessionGeneration(gen);
      setSessionExpired(false);
      setAccessToken(tokens.accessToken);
      setUser(nextUser);
      setStatus("authenticated");
    },
    [],
  );

  useEffect(() => {
    const bootstrapAuth = async () => {
      const [hasBiometric, biometricFlag] = await Promise.all([
        getBiometricAvailability(),
        SecureStore.getItemAsync(BIOMETRIC_FLAG_KEY),
      ]);

      setBiometricAvailable(hasBiometric);

      if (biometricFlag === "true" && hasBiometric) {
        setBiometricEnabled(true);
      } else if (biometricFlag === "true" && !hasBiometric) {
        await clearBiometricStorage();
      }

      setStatus("unauthenticated");
    };

    bootstrapAuth();
  }, [clearBiometricStorage, getBiometricAvailability]);

  const enableBiometric = useCallback(async () => {
    const pendingCredentials = pendingCredentialsRef.current;

    if (!pendingCredentials) {
      Alert.alert("Biometría", "Iniciá sesión con tu contraseña para activar el acceso rápido.");
      return false;
    }

    if (IS_EXPO_GO) {
      Alert.alert(
        "Biometría",
        "En Expo Go no se puede probar este flujo de forma real. Necesitás un development build o build nativa.",
      );
      return false;
    }

    const hasBiometric = await getBiometricAvailability();
    setBiometricAvailable(hasBiometric);

    if (!hasBiometric) {
      Alert.alert("Biometría", "Este dispositivo no tiene biometría disponible o configurada.");
      return false;
    }

    try {
      await promptBiometric();
      await persistBiometricCredentials(pendingCredentials);
      setShouldPromptBiometricEnrollment(false);
      return true;
    } catch {
      Alert.alert("Biometría", "No se pudo activar el acceso rápido biométrico.");
      return false;
    }
  }, [getBiometricAvailability, persistBiometricCredentials, promptBiometric]);

  const disableBiometric = useCallback(async () => {
    await clearBiometricStorage();
    setShouldPromptBiometricEnrollment(false);
  }, [clearBiometricStorage]);

  const login = useCallback(
    async (email: string, password: string) => {
      setSessionExpired(false);
      setLoading(true);
      try {
        const normalizedEmail = email.trim();
        // Si el backend pide cambio de contraseña, authApi lanza
        // PasswordManagedByProviderError y no se crea sesión alguna.
        const response = await authApi.login(normalizedEmail, password);

        pendingCredentialsRef.current = {
          email: normalizedEmail,
          password,
        };

        startSession({ tokens: response.tokens, nextUser: response.user });

        if (!biometricEnabled && biometricAvailable) {
          setShouldPromptBiometricEnrollment(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [biometricAvailable, biometricEnabled, startSession],
  );

  const loginWithBiometric = useCallback(async () => {
    if (!biometricEnabled) {
      throw new Error("La biometría no está activada.");
    }

    setLoading(true);
    try {
      await promptBiometric();
      const credentials = await readBiometricCredentials();

      if (!credentials) {
        await clearBiometricStorage();
        throw new Error("Tu acceso biométrico venció. Iniciá sesión con tu contraseña.");
      }

      let response;
      try {
        response = await authApi.login(credentials.email, credentials.password);
      } catch (error) {
        // Credenciales guardadas ya inválidas (el proveedor cambió la clave, o
        // el backend pide gestión externa) → se borran. Un fallo de red NO
        // borra nada: solo entran acá los rechazos con respuesta del servidor.
        if (
          error instanceof AuthCredentialsError ||
          error instanceof PasswordManagedByProviderError
        ) {
          await clearBiometricStorage();
        }
        throw error;
      }

      pendingCredentialsRef.current = credentials;
      startSession({ tokens: response.tokens, nextUser: response.user });
      setShouldPromptBiometricEnrollment(false);
    } catch (error) {
      if (error instanceof Error && error.message === "user_cancel") {
        throw new Error("Cancelaste la validación biométrica.");
      }
      throw error instanceof Error ? error : new Error("No se pudo iniciar sesión con biometría.");
    } finally {
      setLoading(false);
    }
  }, [biometricEnabled, clearBiometricStorage, promptBiometric, readBiometricCredentials, startSession]);

  /**
   * Único punto de salida. Idempotente por generación: el timer de expiración,
   * un 401 y el listener de AppState pueden llamarlo a la vez sin duplicar.
   *
   * La limpieza local ocurre antes de tocar la red; el token se captura en un
   * snapshot para poder avisar al servidor después de haber limpiado el estado.
   */
  const endSession = useCallback(
    async ({ reason }: { reason: SessionEndReason }) => {
      // El lock apunta a la generación *resultante* del cierre: tras el bump,
      // una segunda llamada lee esa misma generación y sale. Guardar la
      // generación previa no serviría, porque el bump la deja obsoleta al
      // instante y toda llamada posterior volvería a entrar.
      if (endingGenerationRef.current === currentGeneration()) return;

      const tokenSnapshot = accessToken;

      // 1) invalidar generación y limpiar todo lo local
      const nextGen = bumpGeneration();
      endingGenerationRef.current = nextGen;
      clearAllCaches();
      setSessionGeneration(nextGen);
      setStatus("unauthenticated");
      setUser(undefined);
      setAccessToken(undefined);
      pendingCredentialsRef.current = null;
      setShouldPromptBiometricEnrollment(false);

      // 2) política biométrica: solo el cierre manual borra las credenciales
      if (reason === "user") {
        await clearBiometricStorage();
      }

      // 3) aviso al servidor, sin bloquear la UI
      if (tokenSnapshot) {
        logoutApi(tokenSnapshot);
      }
    },
    [accessToken, clearBiometricStorage],
  );

  const logout = useCallback(async () => {
    await endSession({ reason: "user" });
  }, [endSession]);

  useEffect(() => {
    // 401 from any report API call → drop session + redirect to login.
    // Se ignora si proviene de una sesión anterior: una respuesta tardía de la
    // cuenta A no debe desconectar a la cuenta B.
    setOnUnauthorized((gen) => {
      if (!isCurrentGeneration(gen)) return;
      setSessionExpired(true);
      endSession({ reason: "unauthorized" });
    });
    return () => setOnUnauthorized(null);
  }, [endSession]);

  const dismissBiometricEnrollmentPrompt = useCallback(() => {
    setShouldPromptBiometricEnrollment(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      accessToken,
      sessionGeneration,
      biometricEnabled,
      biometricAvailable,
      shouldPromptBiometricEnrollment,
      sessionExpired,
      loading,
      login,
      loginWithBiometric,
      logout,
      enableBiometric,
      disableBiometric,
      dismissBiometricEnrollmentPrompt,
    }),
    [
      accessToken,
      biometricAvailable,
      biometricEnabled,
      disableBiometric,
      dismissBiometricEnrollmentPrompt,
      enableBiometric,
      loading,
      login,
      loginWithBiometric,
      logout,
      sessionExpired,
      sessionGeneration,
      shouldPromptBiometricEnrollment,
      status,
      user,
    ],
  );

  if (AUTH_BYPASS_ENABLED) {
    return <AuthContext.Provider value={AUTH_BYPASS_CONTEXT}>{children}</AuthContext.Provider>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
};
