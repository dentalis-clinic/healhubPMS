import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrescriptionView from "@/components/PrescriptionView";
import type { Medication } from "@/types/patient";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";

export const dynamic = "force-dynamic";

export default async function PrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Support lookup by UUID or prescriptionId (RX-...)
  const isRxId = id.startsWith("RX-");

  const [prescription, clinic] = await Promise.all([
    prisma.prescription.findUnique({
      where: isRxId ? { prescriptionId: id } : { id },
      include: {
        appointment: {
          include: { patient: true },
        },
        prescribedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    getClinicForPage(),
  ]);

  if (!prescription) {
    notFound();
  }

  // Serialize for client component
  const serialized = {
    prescriptionId: prescription.prescriptionId,
    diagnosis: prescription.diagnosis,
    medications: prescription.medications as unknown as Medication[],
    treatmentPlan: prescription.treatmentPlan,
    nextVisitDate: prescription.nextVisitDate?.toISOString() ?? null,
    advice: prescription.advice,
    createdAt: prescription.createdAt.toISOString(),
    prescribedBy: { name: prescription.prescribedBy.name },
    appointment: {
      preferredDateTime:
        prescription.appointment.preferredDateTime.toISOString(),
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
