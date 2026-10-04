import { createAdminClient } from "@/lib/supabase/admin";
import BlankLetterheadTemplate, { type PatientInfo } from "@/components/BlankLetterheadTemplate";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";

interface PageProps {
  searchParams: Promise<{ patientId?: string }>;
}

export default async function BlankTemplatePage({ searchParams }: PageProps) {
  const { patientId } = await searchParams;

  let patient: PatientInfo | undefined;

  const clinic = await getClinicForPage();

  const { data: foundPatient } = patientId && clinic
    ? await createAdminClient()
        .from("patients")
        .select("patientId, name, phone, age, sex, address")
        .eq("id", patientId)
        .eq("clinicId", clinic.id)
        .maybeSingle()
    : { data: null };

  if (foundPatient) {
    patient = {
      patientId: foundPatient.patientId,
      name: foundPatient.name,
      phone: foundPatient.phone,
      age: foundPatient.age,
      sex: foundPatient.sex,
      address: foundPatient.address,
    };
  }

  return <BlankLetterheadTemplate patient={patient} clinic={clinic} />;
}
