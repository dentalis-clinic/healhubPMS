import { prisma } from "@/lib/prisma";
import BlankLetterheadTemplate, { type PatientInfo } from "@/components/BlankLetterheadTemplate";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";

interface PageProps {
  searchParams: Promise<{ patientId?: string }>;
}

export default async function BlankTemplatePage({ searchParams }: PageProps) {
  const { patientId } = await searchParams;

  let patient: PatientInfo | undefined;

  const [foundPatient, clinic] = await Promise.all([
    patientId
      ? prisma.patient.findUnique({
          where: { id: patientId },
          select: { patientId: true, name: true, phone: true, age: true, sex: true, address: true },
        })
      : Promise.resolve(null),
    getClinicForPage(),
  ]);

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
