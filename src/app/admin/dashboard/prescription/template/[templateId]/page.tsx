import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import CustomTemplateView from "@/components/CustomTemplateView";
import SurveyTemplateView from "@/components/SurveyTemplateView";
import type { PatientInfo } from "@/components/BlankLetterheadTemplate";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";

interface PageProps {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ patientId?: string }>;
}

export default async function CustomTemplatePrintPage({ params, searchParams }: PageProps) {
  const { templateId } = await params;
  const { patientId } = await searchParams;

  const clinic = await getClinicForPage();
  if (!clinic) notFound();

  const supabase = createAdminClient();
  const [{ data: template, error: templateError }, { data: foundPatient, error: patientError }] = await Promise.all([
    supabase
      .from("printable_templates")
      .select("title, templateType, showPatientDetails, content")
      .eq("id", templateId)
      .eq("clinicId", clinic.id)
      .maybeSingle(),
    patientId
      ? supabase
          .from("patients")
          .select("patientId, name, phone, age, sex, address")
          .eq("id", patientId)
          .eq("clinicId", clinic.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (templateError) throw templateError;
  if (patientError) throw patientError;

  if (!template) notFound();

  const patient: PatientInfo | undefined = foundPatient
    ? {
        patientId: foundPatient.patientId,
        name: foundPatient.name,
        phone: foundPatient.phone,
        age: foundPatient.age,
        sex: foundPatient.sex,
        address: foundPatient.address,
      }
    : undefined;

  if (template.templateType === "SURVEY") {
    return <SurveyTemplateView template={template} patient={patient} clinic={clinic} />;
  }

  return <CustomTemplateView template={template} patient={patient} clinic={clinic} />;
}
