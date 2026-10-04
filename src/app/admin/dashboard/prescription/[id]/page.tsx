import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PrescriptionView from "@/components/PrescriptionView";
import type { Medication } from "@/types/patient";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";
import { dateOnlyIso, utcIso } from "@/lib/supabase/serialize";

export const dynamic = "force-dynamic";

export default async function PrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Support lookup by UUID or prescriptionId (RX-...)
  const isRxId = id.startsWith("RX-");

  const clinic = await getClinicForPage();
  if (!clinic) notFound();

  const supabase = createAdminClient();
  let query = supabase
    .from("prescriptions")
    .select(
      "prescriptionId, diagnosis, medications, treatmentPlan, nextVisitDate, advice, createdAt, prescribedBy:admins(name), appointment:appointments(preferredDateTime, patient:patients(*))"
    )
    .eq("clinicId", clinic.id);
  query = isRxId ? query.eq("prescriptionId", id) : query.eq("id", id);

  const { data: prescription, error } = await query.maybeSingle();
  if (error) throw error;

  if (!prescription) {
    notFound();
  }

  // Serialize for client component
  const serialized = {
    prescriptionId: prescription.prescriptionId,
    diagnosis: prescription.diagnosis,
    medications: prescription.medications as unknown as Medication[],
    treatmentPlan: prescription.treatmentPlan,
    nextVisitDate: dateOnlyIso(prescription.nextVisitDate),
    advice: prescription.advice,
    createdAt: utcIso(prescription.createdAt),
    prescribedBy: { name: prescription.prescribedBy.name },
    appointment: {
      preferredDateTime: utcIso(prescription.appointment.preferredDateTime),
      patient: {
        patientId: prescription.appointment.patient.patientId,
        name: prescription.appointment.patient.name,
        phone: prescription.appointment.patient.phone,
        email: prescription.appointment.patient.email,
        age: prescription.appointment.patient.age,
        address: prescription.appointment.patient.address ?? null,
      },
    },
  };

  return <PrescriptionView prescription={serialized} clinic={clinic} />;
}
