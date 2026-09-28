/**
 * Minimal shape for a parsed `fetch().json()` API response body.
 * `@types/node`'s newer `Response.json()` typing returns `Promise<unknown>`
 * rather than `any`, so call sites need an explicit cast — this covers the
 * near-universal `{ error?: string }` shape returned by this app's API routes
 * on failure, while still allowing narrower casts for success payloads.
 */
export type ApiJson = {
  success?: boolean;
  error?: string;
  message?: string;
} & Record<string, unknown>;
