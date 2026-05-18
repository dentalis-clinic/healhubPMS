import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PublicBookingForm from "@/components/booking/PublicBookingForm";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const h = await headers();
  if (!h.get("x-clinic-id")) redirect("/register");

  const [clinic] = await Promise.all([getClinicForPage()]);

  const timezone = h.get("x-clinic-timezone") ?? "Asia/Kolkata";
  const clinicPhone = clinic?.phones[0] ?? undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            {clinic?.logo ? (
              <img src={clinic.logo} alt={clinic.name} className="h-14 w-auto object-contain" />
            ) : (
              <Image src="/logo.png" alt="HealthHub PMS Logo" width={180} height={50} className="h-14 w-auto" priority />
            )}
          </div>
          {clinic && (
            <h1 className="text-lg font-semibold text-text-primary">{clinic.name}</h1>
          )}
          <p className="mt-1 text-body-sm text-text-hint">
            Book your dental appointment
          </p>
        </div>

        <PublicBookingForm timezone={timezone} clinicPhone={clinicPhone} />

        <p className="text-center text-caption text-text-tertiary">
          <Link href="/admin/login" className="hover:text-text-secondary">
            Login as Admin
          </Link>
        </p>
      </div>
    </div>
  );
}
