import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";
import PatientsView from "@/components/admin/PatientsView";

const PAGE_SIZE = 30;

async function fetchPatients(clinicId: string) {
  const where = { clinicId };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        patientId: true,
        name: true,
        phone: true,
        email: true,
        age: true,
        sex: true,
        address: true,
        createdAt: true,
        appointments: {
          where: { status: { not: "CANCELLED" } },
          select: {
            preferredDateTime: true,
            totalAmount: true,
            payments: { select: { amount: true } },
          },
          orderBy: { preferredDateTime: "desc" },
        },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  return {
    patients: patients.map((p) => {
      let outstanding = 0;
      let lastVisit: string | null = null;

      for (const apt of p.appointments) {
        if (lastVisit === null) {
          lastVisit = apt.preferredDateTime.toISOString();
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
        createdAt: p.createdAt.toISOString(),
        totalVisits: p.appointments.length,
        lastVisit,
        outstanding: Math.round(outstanding * 100) / 100,
      };
    }),
    total,
  };
}

export default async function PatientsPage() {
  const clinic = await getClinicForPage();
  if (!clinic) redirect("/admin/login");

  const { patients, total } = await fetchPatients(clinic.id);
  return <PatientsView initialPatients={patients} initialTotal={total} />;
}
