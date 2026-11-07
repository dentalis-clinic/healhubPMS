import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAdminAccess();

  if (access.status === "signed_out") redirect("/admin/login");
  // Signed in but not allowed: never back to /admin/login (middleware bounces
  // signed-in users to the dashboard, which would loop).
  if (access.status !== "ok") redirect("/admin/no-access");

  return <>{children}</>;
}
