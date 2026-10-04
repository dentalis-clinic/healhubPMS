import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ClinicAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface ClinicInfo {
  id: string;
  name: string;
  shortName: string;
  timezone: string;
  address: ClinicAddress | null;
  phones: string[];
  email: string | null;
  website: string | null;
  logo: string | null;
}

export async function getClinicForPage(): Promise<ClinicInfo | null> {
  const h = await headers();
  let clinicId = h.get("x-clinic-id");
  const supabaseTable = createAdminClient();

  // Local dev fallback: when the middleware can't resolve a clinic from the
  // subdomain (no DEFAULT_CLINIC_SLUG set), resolve from the logged-in admin's
  // session instead. In production the middleware always sets x-clinic-id from
  // the subdomain, so this branch is never reached there.
  if (!clinicId) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: admin } = await supabaseTable
          .from("admins")
          .select("clinicId")
          .eq("id", user.id)
          .maybeSingle();
        clinicId = admin?.clinicId ?? null;
      }
    } catch {
      // non-fatal — fall through and return null
    }
  }

  if (!clinicId) return null;

  const { data: clinic } = await supabaseTable
    .from("clinics")
    .select("id, name, shortName, timezone, address, phones, email, website, logo")
    .eq("id", clinicId)
    .maybeSingle();

  if (!clinic) return null;

  return {
    id: clinic.id,
    name: clinic.name,
    shortName: clinic.shortName,
    timezone: clinic.timezone,
    address: clinic.address as ClinicAddress | null,
    // Column is nullable in the DB despite schema.prisma's non-optional String[]
    // (documented drift — see CLAUDE.md "Known schema drift").
    phones: clinic.phones ?? [],
    email: clinic.email,
    website: clinic.website,
    logo: clinic.logo,
  };
}
