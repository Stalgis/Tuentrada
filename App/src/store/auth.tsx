import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { enableBioMetric, checkBiometricSupport } from 'react-native-biometric-check';
import type { PropsWithChildren } from 'react';
import { authApi, type AuthTokens } from '../lib/authApi';
import type { User } from '../lib/types';

export type AuthStatus = 'checking' | 'unauthenticated' | 'needsPasswordChange' | 'authenticated';

type AuthContextValue = {
  status: AuthStatus;
  user?: User;
  accessToken?: string;
  sessionToken?: string;
  biometricEnabled: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_BYPASS_ENABLED = false; // set true only for local UI work without backend
const AUTH_BYPASS_USER: User = {
  id: 'dev-bypass',
  name: 'Dashboard Preview',
  initials: 'DP',
  email: 'bypass@tuentrada.com',
};
const AUTH_BYPASS_CONTEXT: AuthContextValue = {
  status: 'authenticated',
  user: AUTH_BYPASS_USER,
  accessToken: 'dev-bypass',
  sessionToken: undefined,
  biometricEnabled: false,
  loading: false,
  login: async () => {},
  changePassword: async () => {},
  logout: async () => {},
  enableBiometric: async () => false,
  disableBiometric: async () => {},
};

const REFRESH_TOKEN_KEY = 'tuentrada_refresh_token';
const BIOMETRIC_FLAG_KEY = 'tuentrada_biometric_enabled';

const BIOMETRIC_PROMPT_TITLE = Platform.OS === 'ios' ? 'Face ID' : 'Biometria';
const BIOMETRIC_PROMPT_SUBTITLE =
  Platform.OS === 'ios'
    ? 'Autoriza el acceso con Face ID o codigo de seguridad.'
    : 'Usa tu huella, rostro o PIN para continuar.';

const useBiometricPrompt = () => {
  const runPrompt = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        if (Platform.OS === 'ios') {
          enableBioMetric(BIOMETRIC_PROMPT_TITLE, BIOMETRIC_PROMPT_SUBTITLE, (result: unknown) => {
            if (result === 5) {
              resolve();
            } else {
              reject(typeof result === 'string' ? new Error(result) : new Error('FACE_ID_DENIED'));
            }
          });
          return;
        }

        checkBiometricSupport((support: unknown) => {
          if (support !== 'SUCCESS') {
            reject(new Error(String(support)));
            return;
          }

          enableBioMetric(BIOMETRIC_PROMPT_TITLE, BIOMETRIC_PROMPT_SUBTITLE, (result: unknown) => {
            if (result === 'BIOMETRICS_SUCCESS') {
              resolve();
            } else {
              reject(new Error(String(result)));
            }
          });
        });
      }),
    [],
  );

  return runPrompt;
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  if (AUTH_BYPASS_ENABLED) {
    return <AuthContext.Provider value={AUTH_BYPASS_CONTEXT}>{children}</AuthContext.Provider>;
  }

  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<User | undefined>(undefined);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const refreshTokenRef = useRef<string | null>(null);
  const promptBiometric = useBiometricPrompt();

  const persistTokens = useCallback(async (tokens: AuthTokens) => {
    const refreshToken = tokens.refreshToken ?? null;
    refreshTokenRef.current = refreshToken;
    console.log('[Auth] Tokens recibidos', tokens);

    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }

    setAccessToken(tokens.accessToken);
  }, []);

  const clearStorage = useCallback(async () => {
    refreshTokenRef.current = null;
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }, []);

  const handleAuthSuccess = useCallback(
    async ({ tokens, nextUser }: { tokens: AuthTokens; nextUser: User }) => {
      await persistTokens(tokens);
      setUser(nextUser);
      setStatus('authenticated');
      setSessionToken(undefined);
    },
    [persistTokens],
  );

  const bootstrapAuth = useCallback(async () => {
    try {
      const [storedRefresh, storedBiometricFlag] = await Promise.all([
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(BIOMETRIC_FLAG_KEY),
      ]);

      const hasBiometric = storedBiometricFlag === 'true';
      setBiometricEnabled(hasBiometric);

      if (!storedRefresh) {
        setStatus('unauthenticated');
        return;
      }

      if (hasBiometric) {
        try {
          await promptBiometric();
        } catch (error) {
          await clearStorage();
          setStatus('unauthenticated');
          Alert.alert('Biometria', 'No se pudo validar tu identidad. Inicia sesion manualmente.');
          return;
        }
      }

      const { tokens, user: nextUser } = await authApi.refresh(storedRefresh);
      await persistTokens(tokens);
      setUser(nextUser);
      setStatus('authenticated');
    } catch (error) {
      await clearStorage();
      setStatus('unauthenticated');
    }
  }, [clearStorage, persistTokens, promptBiometric]);

  useEffect(() => {
    bootstrapAuth();
  }, [bootstrapAuth]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const response = await authApi.login(email.trim(), password);
        if (response.status === 'needsPasswordChange') {
          setUser(response.user);
          setSessionToken((response as unknown as { sessionToken?: string }).sessionToken);
          setStatus('needsPasswordChange');
          return;
        }
        await handleAuthSuccess({ tokens: response.tokens, nextUser: response.user });
      } finally {
        setLoading(false);
      }
    },
    [handleAuthSuccess],
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!sessionToken) {
        throw new Error('Sesion no disponible');
      }
      setLoading(true);
      try {
        const { tokens, user: nextUser } = await authApi.changePassword(sessionToken, newPassword);
        await handleAuthSuccess({ tokens, nextUser });
      } finally {
        setLoading(false);
      }
    },
    [handleAuthSuccess, sessionToken],
  );

  const logout = useCallback(async () => {
    setStatus('unauthenticated');
    setUser(undefined);
    setAccessToken(undefined);
    setSessionToken(undefined);
    await clearStorage();
    await SecureStore.deleteItemAsync(BIOMETRIC_FLAG_KEY);
    setBiometricEnabled(false);
  }, [clearStorage]);

  const enableBiometric = useCallback(async () => {
    if (!refreshTokenRef.current) {
      Alert.alert('Biometria', 'Inicia sesion para activar Face ID.');
      return false;
    }
    try {
      await promptBiometric();
      await SecureStore.setItemAsync(BIOMETRIC_FLAG_KEY, 'true');
      setBiometricEnabled(true);
      return true;
    } catch (error) {
      Alert.alert('Biometria', 'No se pudo habilitar Face ID / biometria.');
      return false;
    }
  }, [promptBiometric]);

  const disableBiometric = useCallback(async () => {
    await SecureStore.deleteItemAsync(BIOMETRIC_FLAG_KEY);
    setBiometricEnabled(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      accessToken,
      sessionToken,
      biometricEnabled,
      loading,
      login,
      changePassword,
      logout,
      enableBiometric,
      disableBiometric,
    }),
    [
      accessToken,
      biometricEnabled,
      changePassword,
      disableBiometric,
      loading,
      login,
      logout,
      sessionToken,
      status,
      user,
      enableBiometric,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
