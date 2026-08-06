// lib/authApi.tsx
import type { User } from "./types";
import { env } from "./env";

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

/**
 * El proveedor administra las contraseñas: la app no ofrece cambio de
 * contraseña. Si un backend viejo responde 403 pidiéndolo, se corta el login
 * sin crear sesión ni guardar ningún token.
 */
export class PasswordManagedByProviderError extends Error {
  constructor() {
    super("Tu contraseña debe ser gestionada por tu proveedor. Contactalo para continuar.");
    this.name = "PasswordManagedByProviderError";
  }
}

/** El backend respondió, pero rechazó las credenciales (no es un fallo de red). */
export class AuthCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthCredentialsError";
  }
}

/** El backend falló procesando el login; las credenciales pueden seguir siendo válidas. */
export class AuthServerError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthServerError";
    this.status = status;
  }
}

/** La respuesta no cumple el contrato esperado, sin implicar credenciales inválidas. */
export class AuthResponseError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthResponseError";
    this.status = status;
  }
}

const BASE_URL = env.apiUrl;
const baseHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "x-api-key": env.apiKey,
};

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
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    const message = "El servidor devolvió una respuesta inválida";
    if (res.status >= 500) {
      throw new AuthServerError(res.status, message);
    }
    throw new AuthResponseError(res.status, message);
  }

  const message =
    typeof json?.message === "string" ? json.message : "No se pudo autenticar";

  if (res.status === 401 || res.status === 403) {
    throw new AuthCredentialsError(message);
  }

  if (res.status >= 500) {
    throw new AuthServerError(res.status, message);
  }

  if (!res.ok || json?.success === false) {
    throw new AuthResponseError(res.status, message);
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
  ): Promise<{ tokens: AuthTokens; user: User }> {
    const res = await fetch(`${BASE_URL}`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ email, password }),
    });

    // Un 403 puede ser el flujo antiguo de cambio de contraseña o cualquier
    // otro rechazo. Solo el primero muestra el mensaje del proveedor; el resto
    // se trata como credenciales rechazadas para no dar instrucciones erróneas.
    if (res.status === 403) {
      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        // cuerpo no-JSON: se trata como rechazo genérico
      }

      // La respuesta legacy se identifica por traer un token de cambio de
      // contraseña. Se detecta para clasificarla, pero nunca se usa ni guarda.
      if (payload && typeof payload.sessionToken === "string") {
        throw new PasswordManagedByProviderError();
      }

      throw new AuthCredentialsError(
        typeof payload?.message === "string" ? payload.message : "No se pudo autenticar",
      );
    }

    const raw = await parseResponse(res);
    const tokens = toTokens(raw);
    const user = buildUserFromEmail(raw.data.email);

    return { tokens, user };
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
