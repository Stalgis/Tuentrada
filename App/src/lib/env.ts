import { z } from "zod";

const isDev = __DEV__;

const urlSchema = z
  .string()
  .min(1, "es requerido")
  .trim()
  .refine((val) => {
    try {
      const url = new URL(val);
      return isDev ? url.protocol === "http:" || url.protocol === "https:" : url.protocol === "https:";
    } catch {
      return false;
    }
  }, isDev ? "debe ser una URL válida (http o https)" : "debe ser una URL válida con HTTPS");

const schema = z.object({
  EXPO_PUBLIC_API_URL: urlSchema,
  EXPO_PUBLIC_BASE_URL: urlSchema,
  EXPO_PUBLIC_API_KEY: z.string().trim().min(1, "es requerido"),
});

const parsed = schema.safeParse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_BASE_URL: process.env.EXPO_PUBLIC_BASE_URL,
  EXPO_PUBLIC_API_KEY: process.env.EXPO_PUBLIC_API_KEY,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Variables de entorno inválidas. Revisá App/.env (ver App/.env.example):\n${issues}`,
  );
}

export const env = {
  apiUrl: parsed.data.EXPO_PUBLIC_API_URL,
  baseUrl: parsed.data.EXPO_PUBLIC_BASE_URL.replace(/\/+$/, ""),
  apiKey: parsed.data.EXPO_PUBLIC_API_KEY,
} as const;
