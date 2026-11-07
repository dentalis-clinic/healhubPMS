import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/require-admin";
import { DashboardProvider } from "@/components/admin/DashboardContext";
import Sidebar from "@/components/admin/Sidebar";
import DashboardHeader from "@/components/admin/DashboardHeader";
import AppointmentSlideOver from "@/components/admin/AppointmentSlideOver";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layouts can render in parallel with their parent, so this one checks too.
  const access = await getAdminAccess();
  if (access.status === "signed_out") redirect("/admin/login");
  if (access.status !== "ok") redirect("/admin/no-access");
  const { admin } = access;

  return (
    <DashboardProvider adminId={admin.id}>
      <div className="min-h-screen bg-surface-secondary">
        <Sidebar adminInfo={{ name: admin.name, email: admin.email }} />
        <div className="lg:pl-64">
          <DashboardHeader />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
        <AppointmentSlideOver />
      </div>
    </DashboardProvider>
  );
}
