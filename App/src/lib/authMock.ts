import type { User } from './types';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type LoginSuccess =
  | {
      status: 'authenticated';
      tokens: AuthTokens;
      user: User;
    };

const mockUser: User = {
  id: 'user-1',
  name: 'Martina Álvarez',
  initials: 'MA',
  email: 'cliente@tuentrada.com',
};

const authState = {
  email: mockUser.email,
  password: 'Cliente#2025',
  refreshToken: null as string | null,
};

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

const issueTokens = (): AuthTokens => {
  const accessToken = `access_${Math.random().toString(36).slice(2)}`;
  const refreshToken = `refresh_${Math.random().toString(36).slice(2)}`;
  const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes
  authState.refreshToken = refreshToken;
  return { accessToken, refreshToken, expiresAt };
};

export const mockAuthApi = {
  async login(email: string, password: string): Promise<LoginSuccess> {
    await delay();

    if (email.toLowerCase() !== (authState.email ?? "").toLowerCase()) {
      throw new Error('Usuario no encontrado');
    }

    if (password !== authState.password) {
      throw new Error('Credenciales inválidas');
    }

    return {
      status: 'authenticated',
      tokens: issueTokens(),
      user: mockUser,
    };
  },

  async refresh(refreshToken: string): Promise<{ tokens: AuthTokens; user: User }> {
    await delay(500);

    if (!authState.refreshToken || refreshToken !== authState.refreshToken) {
      throw new Error('Token inválido');
    }

    return { tokens: issueTokens(), user: mockUser };
  },
};
