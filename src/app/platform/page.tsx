import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAdmin } from "@/lib/auth/require-platform-admin";
import { PlatformConsole } from "@/components/platform/PlatformConsole";
import NotAuthorized from "./NotAuthorized";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Platform",
  robots: { index: false, follow: false },
};

export default async function PlatformPage() {
  const result = await getPlatformAdmin();

  if (!result) {
    // Middleware already sent signed-out visitors to /platform/login, so a
    // signed-in user here is someone else (e.g. a clinic admin).
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user) redirect("/platform/login");
    return <NotAuthorized email={user.email} />;
  }

  return <PlatformConsole adminName={result.platformAdmin.name} adminEmail={result.platformAdmin.email} />;
}
