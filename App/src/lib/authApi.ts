// lib/authApi.tsx
import type { User } from "./types";

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string | null; // 👉 ahora opcional
  expiresAt?: number;
};

// Respuesta cruda del backend
type LoginRawResponse = {
  success: boolean;
  message: string;
  data: {
    email: string;
    access_token: string;
    token_type: string;
    expired_at: string; // ISO con zona horaria
  };
  errors: unknown;
  meta: {
    timestamp: string;
  };
};

type LoginNeedsPasswordChangeResponse = {
  user: User;
  sessionToken: string;
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const baseHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

if (process.env.EXPO_PUBLIC_API_KEY) {
  baseHeaders["x-api-key"] = process.env.EXPO_PUBLIC_API_KEY;
}

// Construimos el AuthTokens a partir de la respuesta cruda
const toTokens = (raw: LoginRawResponse): AuthTokens => ({
  accessToken: raw.data.access_token,
  refreshToken: null, // 👉 tu backend NO maneja refresh tokens (por ahora)
  expiresAt: raw.data.expired_at
    ? new Date(raw.data.expired_at).getTime()
    : undefined,
});

// Como tu backend envía todo envuelto bajo { success, message, data, ... }
const parseResponse = async (res: Response): Promise<LoginRawResponse> => {
  const json = (await res.json()) as any;

  if (!res.ok || json?.success === false) {
    let message = "No se pudo autenticar";
    if (json && typeof json.message === "string") {
      message = json.message;
    }
    throw new Error(message);
  }

  return json as LoginRawResponse;
};

// Helper para inventar un User mínimo a partir del email
const buildUserFromEmail = (email: string): User =>
  ({
    id: email,
    email,
    name: email,
    initials: email.charAt(0).toUpperCase(),
    // si tu tipo User tiene más campos obligatorios, los agregás acá
  } as User);

export const authApi = {
  async login(
    email: string,
    password: string
  ): Promise<
    | { status: "authenticated"; tokens: AuthTokens; user: User }
    | { status: "needsPasswordChange"; user: User; sessionToken: string }
  > {
    const res = await fetch(`${BASE_URL}`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ email, password }),
    });

    if (res.status === 403) {
      const data = (await res.json()) as LoginNeedsPasswordChangeResponse;
      return {
        status: "needsPasswordChange",
        user: data.user,
        sessionToken: data.sessionToken,
      };
    }

    const raw = await parseResponse(res);
    const tokens = toTokens(raw);
    const user = buildUserFromEmail(raw.data.email);

    return {
      status: "authenticated",
      tokens,
      user,
    };
  },

  async refresh(refreshToken: string) {
    // 👉 hoy tu backend no tiene refresh real; podés dejar esto como TODO
    // o que llame a otro endpoint cuando exista.
    // De momento, si alguien lo llama, va a tirar error y el bootstrapAuth
    // te va a mandar a "unauthenticated".
    const res = await fetch(`${BASE_URL}/refresh`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ refreshToken }),
    });

    const raw = await parseResponse(res);
    const tokens = toTokens(raw);
    const user = buildUserFromEmail(raw.data.email);

    return { tokens, user };
  },
};
