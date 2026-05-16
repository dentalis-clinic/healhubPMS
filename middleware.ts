import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware runs on every matched request to:
 * 1. Resolve the clinic from the subdomain (e.g., ddcj.healthhub.app → clinicId)
 * 2. Inject clinic context headers (x-clinic-id, x-clinic-timezone, x-clinic-short-name)
 * 3. Refresh the Supabase session (prevents stale JWTs)
 * 4. Protect /admin/* routes (except /admin/login)
 *
 * Does NOT use Prisma — Edge runtime requires fetch-based DB access (Supabase REST).
 * Local dev: set DEFAULT_CLINIC_SLUG=<slug> in .env.local to simulate a clinic subdomain.
 * Without it, localhost behaves like the root SaaS domain and redirects to /register.
 */
export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  const { pathname } = request.nextUrl;

  // Registration paths don't belong to any clinic — skip subdomain resolution.
  const CLINIC_FREE = ["/register", "/api/onboarding"];
  const skipClinicResolution = CLINIC_FREE.some((p) => pathname.startsWith(p));

  // --- Clinic resolution ---
  const host = request.headers.get("host") ?? "";
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  // Production: extract subdomain. Local dev: use DEFAULT_CLINIC_SLUG if set.
  const clinicSlug = isLocalhost
    ? (process.env.DEFAULT_CLINIC_SLUG ?? "")
    : host.split(".")[0];

  if (!skipClinicResolution && clinicSlug) try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/clinics?slug=eq.${encodeURIComponent(clinicSlug)}&select=id,shortName,timezone,isActive&limit=1`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
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
