import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import BlankPrescriptionTemplate from "@/components/BlankPrescriptionTemplate";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";
import { utcIso } from "@/lib/supabase/serialize";

interface PageProps {
  params: Promise<{ appointmentId: string }>;
}

export default async function BlankPrescriptionPage({ params }: PageProps) {
  const { appointmentId } = await params;

  const clinic = await getClinicForPage();
  if (!clinic) notFound();

  const { data: appointment, error } = await createAdminClient()
    .from("appointments")
    .select("id, preferredDateTime, reasonForVisit, patient:patients(*), doctor:doctors(name, qualifications, registrationNumber)")
    .eq("id", appointmentId)
    .eq("clinicId", clinic.id)
    .maybeSingle();
  if (error) throw error;

  if (!appointment) {
    notFound();
  }

  // Serialize dates
  const serialized = {
    id: appointment.id,
    preferredDateTime: utcIso(appointment.preferredDateTime),
    reasonForVisit: appointment.reasonForVisit,
    patient: {
      patientId: appointment.patient.patientId,
      name: appointment.patient.name,
      phone: appointment.patient.phone,
      email: appointment.patient.email,
      age: appointment.patient.age,
      sex: appointment.patient.sex,
      address: appointment.patient.address,
    },
    doctor: appointment.doctor
      ? {
          name: appointment.doctor.name,
          qualifications: appointment.doctor.qualifications,
          registrationNumber: appointment.doctor.registrationNumber,
        }
      : null,
  };

  return <BlankPrescriptionTemplate appointment={serialized} clinic={clinic} />;
}
