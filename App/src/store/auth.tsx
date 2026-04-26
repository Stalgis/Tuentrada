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
import { authApi, type AuthTokens } from "../lib/authApi";
import { logoutApi, setOnUnauthorized } from "../lib/reportApi";
import type { User } from "../lib/types";

export type AuthStatus = "checking" | "unauthenticated" | "authenticated";

type AuthContextValue = {
  status: AuthStatus;
  user?: User;
  accessToken?: string;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  shouldPromptBiometricEnrollment: boolean;
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
  biometricEnabled: false,
  biometricAvailable: false,
  shouldPromptBiometricEnrollment: false,
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
  const [loading, setLoading] = useState(false);
  const pendingCredentialsRef = useRef<StoredBiometricCredentials | null>(null);

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

  const handleAuthSuccess = useCallback(
    async ({ tokens, nextUser }: { tokens: AuthTokens; nextUser: User }) => {
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
      setLoading(true);
      try {
        const normalizedEmail = email.trim();
        const response = await authApi.login(normalizedEmail, password);

        if (response.status === "needsPasswordChange") {
          setAccessToken(response.sessionToken);
          setUser(response.user);
          setStatus("authenticated");
          return;
        }

        pendingCredentialsRef.current = {
          email: normalizedEmail,
          password,
        };

        await handleAuthSuccess({ tokens: response.tokens, nextUser: response.user });

        if (!biometricEnabled && biometricAvailable) {
          setShouldPromptBiometricEnrollment(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [biometricAvailable, biometricEnabled, handleAuthSuccess],
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

      const response = await authApi.login(credentials.email, credentials.password);

      if (response.status !== "authenticated") {
        await clearBiometricStorage();
        throw new Error("Necesitás iniciar sesión manualmente para reactivar biometría.");
      }

      pendingCredentialsRef.current = credentials;
      await handleAuthSuccess({ tokens: response.tokens, nextUser: response.user });
      setShouldPromptBiometricEnrollment(false);
    } catch (error) {
      if (error instanceof Error && error.message === "user_cancel") {
        throw new Error("Cancelaste la validación biométrica.");
      }
      throw error instanceof Error ? error : new Error("No se pudo iniciar sesión con biometría.");
    } finally {
      setLoading(false);
    }
  }, [biometricEnabled, clearBiometricStorage, handleAuthSuccess, promptBiometric, readBiometricCredentials]);

  const logout = useCallback(async () => {
    // Fire-and-forget: notify server without blocking UI
    if (accessToken) {
      logoutApi(accessToken);
    }
    setStatus("unauthenticated");
    setUser(undefined);
    setAccessToken(undefined);
    pendingCredentialsRef.current = null;
    setShouldPromptBiometricEnrollment(false);
    await clearBiometricStorage();
  }, [accessToken, clearBiometricStorage]);

  useEffect(() => {
    // 401 from any report API call → drop session + redirect to login
    setOnUnauthorized(() => {
      logout();
    });
    return () => setOnUnauthorized(null);
  }, [logout]);

  const dismissBiometricEnrollmentPrompt = useCallback(() => {
    setShouldPromptBiometricEnrollment(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      accessToken,
      biometricEnabled,
      biometricAvailable,
      shouldPromptBiometricEnrollment,
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
