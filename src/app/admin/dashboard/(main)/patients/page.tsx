import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";
import { utcIso } from "@/lib/supabase/serialize";
import PatientsView from "@/components/admin/PatientsView";

const PAGE_SIZE = 30;

async function fetchPatients(clinicId: string) {
  // Dot-path filter on a plain (non-`!inner`) embed filters which appointment
  // ROWS are returned, not which patients — a patient with only cancelled
  // appointments still comes back, with an empty `appointments` array.
  const { data: patients, count, error } = await createAdminClient()
    .from("patients")
    .select(
      "id, patientId, name, phone, email, age, sex, address, createdAt, appointments(preferredDateTime, totalAmount, payments(amount))",
      { count: "exact" }
    )
    .eq("clinicId", clinicId)
    .neq("appointments.status", "CANCELLED")
    .order("createdAt", { ascending: false })
    .order("preferredDateTime", { referencedTable: "appointments", ascending: false })
    .range(0, PAGE_SIZE - 1);
  if (error) throw error;

  return {
    patients: patients.map((p) => {
      let outstanding = 0;
      let lastVisit: string | null = null;

      for (const apt of p.appointments) {
        if (lastVisit === null) {
          lastVisit = utcIso(apt.preferredDateTime);
        }
        if (apt.totalAmount != null) {
          const paid = apt.payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
          const bal = Number(apt.totalAmount) - paid;
          if (bal > 0) outstanding += bal;
        }
      }

      return {
        id: p.id,
        patientId: p.patientId,
        name: p.name,
        phone: p.phone,
        email: p.email,
        age: p.age,
        sex: p.sex,
        address: p.address,
        createdAt: utcIso(p.createdAt),
        totalVisits: p.appointments.length,
        lastVisit,
        outstanding: Math.round(outstanding * 100) / 100,
      };
    }),
    total: count ?? 0,
  };
}

export default async function PatientsPage() {
  const clinic = await getClinicForPage();
  if (!clinic) redirect("/admin/login");

  const { patients, total } = await fetchPatients(clinic.id);
  return <PatientsView initialPatients={patients} initialTotal={total} />;
}
