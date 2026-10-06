import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isTestHost } from "@/lib/constants/app";

/**
 * Middleware runs on every matched request to:
 * 1. Resolve the clinic from the subdomain (e.g., ddcj.healthhub.app → clinicId)
 * 2. Inject clinic context headers (x-clinic-id, x-clinic-timezone, x-clinic-short-name)
 * 3. Refresh the Supabase session (prevents stale JWTs)
 * 4. Protect /admin/* routes (except /admin/login)
 *
 * Uses fetch-based DB access (Supabase REST) only.
 * Local dev and *.workers.dev test deploys can't carry a clinic subdomain, so on those
 * hosts DEFAULT_CLINIC_SLUG=<slug> picks the clinic. Without it, they behave like the
 * root SaaS domain and redirect to /register. It has no effect on <slug>.<appDomain>.
 */
export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Routes trust these as middleware-verified — never let a client supply them.
  for (const h of ["x-clinic-id", "x-clinic-timezone", "x-clinic-short-name"]) requestHeaders.delete(h);

  const { pathname } = request.nextUrl;

  // Registration and the super admin panel don't belong to any clinic — skip subdomain resolution.
  const CLINIC_FREE = ["/register", "/api/onboarding", "/platform", "/api/platform"];
  const skipClinicResolution = CLINIC_FREE.some((p) => pathname.startsWith(p));

  // --- Clinic resolution ---
  const host = (request.headers.get("host") ?? "").split(":")[0]; // strip port if present
  // Production: only treat host as a clinic subdomain when it matches <slug>.<appDomain>.
  // The root app domain itself must never resolve to a clinic — those requests go to /register.
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "healthhub.app";

  const clinicSlug = isTestHost(host)
    ? (process.env.DEFAULT_CLINIC_SLUG ?? "")
    : (() => {
        if (host === appDomain || host === `www.${appDomain}`) return "";
        if (host.endsWith(`.${appDomain}`)) {
          return host.slice(0, host.length - appDomain.length - 1);
        }
        // Unrecognised host — treat as root domain.
        return "";
      })();

  if (!skipClinicResolution && clinicSlug) try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const res = await fetch(
      `${supabaseUrl}/rest/v1/clinics?slug=eq.${encodeURIComponent(clinicSlug)}&select=id,shortName,timezone,isActive&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (res.ok) {
      const clinics = (await res.json()) as Array<{
        id: string;
        shortName: string;
        timezone: string;
        isActive: boolean;
      }>;
      const clinic = clinics[0];

      if (clinic?.isActive) {
        requestHeaders.set("x-clinic-id", clinic.id);
        requestHeaders.set("x-clinic-timezone", clinic.timezone);
        requestHeaders.set("x-clinic-short-name", clinic.shortName);
      }
    }
  } catch {
    // Non-fatal: clinic headers will be absent; individual routes return 503
  }

  // --- Supabase session refresh ---
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            requestHeaders.set("cookie", `${name}=${value}`)
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getUser() (server-verified) not getSession() (reads cookie only).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /admin/* routes (except /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect /platform/* (except /platform/login). Signed in isn't enough — the
  // page and every /api/platform route also check the platform_admins table.
  if (pathname.startsWith("/platform") && pathname !== "/platform/login" && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/platform/login";
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from /admin/login → dashboard
  if (pathname === "/admin/login" && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/admin/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Common image file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
