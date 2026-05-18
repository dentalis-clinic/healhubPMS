import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  const [template, foundPatient, clinic] = await Promise.all([
    prisma.printable_templates.findUnique({
      where: { id: templateId },
      select: { title: true, templateType: true, showPatientDetails: true, content: true },
    }),
    patientId
      ? prisma.patient.findUnique({
          where: { id: patientId },
          select: { patientId: true, name: true, phone: true, age: true, sex: true, address: true },
        })
      : Promise.resolve(null),
    getClinicForPage(),
  ]);

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
