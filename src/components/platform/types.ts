export interface PlatformClinic {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  email: string | null;
  phones: string[];
  isActive: boolean;
  createdAt: string;
  adminCount: number;
  patientCount: number;
  appointmentCount: number;
  lastAppointmentAt: string | null;
}

export interface PlatformClinicAdmin {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}
