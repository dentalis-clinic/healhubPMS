/**
 * Root SaaS domain; clinics live at <slug>.<APP_DOMAIN>. NEXT_PUBLIC_ values are
 * inlined at build time, and Workers Builds doesn't set this one, so the fallback
 * is what the browser sees. Changing the domain means changing it here and in
 * wrangler.jsonc (var and routes).
 */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "dentalispms.com";

/**
 * Hosts that can't carry a clinic subdomain (local dev, *.workers.dev test
 * deploys). There, the middleware serves DEFAULT_CLINIC_SLUG and links should
 * stay on the current origin.
 */
export function isTestHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".workers.dev");
}
