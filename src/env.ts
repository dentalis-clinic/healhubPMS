import { z } from "zod/v4";

/**
 * Server-side environment variables — validated at import time.
 * These are NOT exposed to the browser.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Optional rate limiting
  UPSTASH_REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),
  RATE_LIMIT_MAX: z.coerce.number().positive().default(3),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(3_600_000),
});

/**
 * Client-side environment variables — must use NEXT_PUBLIC_ prefix.
 * These are inlined at build time and available in the browser.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

const merged = serverSchema.merge(clientSchema);

function validateEnv() {
  const parsed = merged.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(z.prettifyError(parsed.error));
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = validateEnv();
export type Env = z.infer<typeof merged>;
