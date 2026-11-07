import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/require-admin";
import { getPlatformAdmin } from "@/lib/auth/require-platform-admin";
import NoAccess from "./NoAccess";

export const dynamic = "force-dynamic";

/**
 * Where a signed-in user lands when they aren't allowed into the dashboard.
 * Re-checks access so a stale bookmark or a fixed account goes to the right place.
 */
export default async function AdminNoAccessPage() {
  const access = await getAdminAccess();

  if (access.status === "signed_out") redirect("/admin/login");
  if (access.status === "ok") redirect("/admin/dashboard");

  const isPlatformAdmin = access.status === "not_admin" && (await getPlatformAdmin()) !== null;

  return <NoAccess email={access.user.email} reason={access.status} isPlatformAdmin={isPlatformAdmin} />;
}
