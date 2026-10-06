/**
 * Root SaaS domain; clinics live at <slug>.<APP_DOMAIN>. Placeholder until a
 * domain is bought. Inlined into client code at build time, so changing it
 * means setting the build variable as well as the wrangler.jsonc var.
 */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "healthhub.app";

/**
 * Hosts that can't carry a clinic subdomain (local dev, *.workers.dev test
 * deploys). There, the middleware serves DEFAULT_CLINIC_SLUG and links should
 * stay on the current origin.
 */
export function isTestHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".workers.dev");
}
