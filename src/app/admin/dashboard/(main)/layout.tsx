import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardProvider } from "@/components/admin/DashboardContext";
import Sidebar from "@/components/admin/Sidebar";
import DashboardHeader from "@/components/admin/DashboardHeader";
import AppointmentSlideOver from "@/components/admin/AppointmentSlideOver";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const admin = await prisma.admin.findUnique({ where: { id: user.id } });
  if (!admin) {
    redirect("/admin/login");
  }

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
