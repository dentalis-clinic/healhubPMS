export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number;
          checksum: string;
          finished_at: string | null;
          id: string;
          logs: string | null;
          migration_name: string;
          rolled_back_at: string | null;
          started_at: string;
        };
        Insert: {
          applied_steps_count?: number;
          checksum: string;
          finished_at?: string | null;
          id: string;
          logs?: string | null;
          migration_name: string;
          rolled_back_at?: string | null;
          started_at?: string;
        };
        Update: {
          applied_steps_count?: number;
          checksum?: string;
          finished_at?: string | null;
          id?: string;
          logs?: string | null;
          migration_name?: string;
          rolled_back_at?: string | null;
          started_at?: string;
        };
        Relationships: [];
      };
      admins: {
        Row: {
          clinicId: string;
          createdAt: string;
          email: string;
          id: string;
          name: string;
          updatedAt: string;
        };
        Insert: {
          clinicId: string;
          createdAt?: string;
          email: string;
          id: string;
          name: string;
          updatedAt: string;
        };
        Update: {
          clinicId?: string;
          createdAt?: string;
          email?: string;
          id?: string;
          name?: string;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admins_clinicId_fkey";
            columns: ["clinicId"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          adminUserId: string | null;
          appointmentId: string;
          bookingChannel: Database["public"]["Enums"]["BookingChannel"];
          clinicId: string;
          createdAt: string;
          doctorId: string | null;
          id: string;
          notes: string | null;
          patientId: string;
          preferredDateTime: string;
          priority: Database["public"]["Enums"]["AppointmentPriority"] | null;
          reasonForVisit: string | null;
          status: Database["public"]["Enums"]["AppointmentStatus"];
          submittedBy: Database["public"]["Enums"]["SubmissionSource"];
          totalAmount: number | null;
          type: Database["public"]["Enums"]["AppointmentType"] | null;
          updatedAt: string;
          visitType: Database["public"]["Enums"]["VisitType"];
        };
        Insert: {
          adminUserId?: string | null;
          appointmentId: string;
          bookingChannel: Database["public"]["Enums"]["BookingChannel"];
          clinicId: string;
          createdAt?: string;
          doctorId?: string | null;
          id: string;
          notes?: string | null;
          patientId: string;
          preferredDateTime: string;
          priority?: Database["public"]["Enums"]["AppointmentPriority"] | null;
          reasonForVisit?: string | null;
          status?: Database["public"]["Enums"]["AppointmentStatus"];
          submittedBy: Database["public"]["Enums"]["SubmissionSource"];
          totalAmount?: number | null;
          type?: Database["public"]["Enums"]["AppointmentType"] | null;
          updatedAt: string;
          visitType: Database["public"]["Enums"]["VisitType"];
        };
        Update: {
          adminUserId?: string | null;
          appointmentId?: string;
          bookingChannel?: Database["public"]["Enums"]["BookingChannel"];
          clinicId?: string;
          createdAt?: string;
          doctorId?: string | null;
          id?: string;
          notes?: string | null;
          patientId?: string;
          preferredDateTime?: string;
          priority?: Database["public"]["Enums"]["AppointmentPriority"] | null;
          reasonForVisit?: string | null;
          status?: Database["public"]["Enums"]["AppointmentStatus"];
          submittedBy?: Database["public"]["Enums"]["SubmissionSource"];
          totalAmount?: number | null;
          type?: Database["public"]["Enums"]["AppointmentType"] | null;
          updatedAt?: string;
          visitType?: Database["public"]["Enums"]["VisitType"];
        };
        Relationships: [
          {
            foreignKeyName: "appointments_adminUserId_fkey";
            columns: ["adminUserId"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_clinicId_fkey";
            columns: ["clinicId"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_doctorId_fkey";
            columns: ["doctorId"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_patientId_fkey";
            columns: ["patientId"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      clinics: {
        Row: {
          address: Json | null;
          businessHours: Json | null;
          createdAt: string;
          email: string | null;
          id: string;
          isActive: boolean;
          logo: string | null;
          name: string;
          phones: string[] | null;
          shortName: string;
          slotDuration: number | null;
          slug: string;
          timezone: string;
          updatedAt: string;
          website: string | null;
        };
        Insert: {
          address?: Json | null;
          businessHours?: Json | null;
          createdAt?: string;
          email?: string | null;
          id: string;
          isActive?: boolean;
          logo?: string | null;
          name: string;
          phones?: string[] | null;
          shortName: string;
          slotDuration?: number | null;
          slug: string;
          timezone?: string;
          updatedAt: string;
          website?: string | null;
        };
        Update: {
          address?: Json | null;
          businessHours?: Json | null;
          createdAt?: string;
          email?: string | null;
          id?: string;
          isActive?: boolean;
          logo?: string | null;
          name?: string;
          phones?: string[] | null;
          shortName?: string;
          slotDuration?: number | null;
          slug?: string;
          timezone?: string;
          updatedAt?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      doctors: {
        Row: {
          clinicId: string;
          createdAt: string;
          id: string;
          isActive: boolean;
          name: string;
          qualifications: string | null;
          registrationNumber: string | null;
          updatedAt: string;
        };
        Insert: {
          clinicId: string;
          createdAt?: string;
          id: string;
          isActive?: boolean;
          name: string;
          qualifications?: string | null;
          registrationNumber?: string | null;
          updatedAt: string;
        };
        Update: {
          clinicId?: string;
          createdAt?: string;
          id?: string;
          isActive?: boolean;
          name?: string;
          qualifications?: string | null;
          registrationNumber?: string | null;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "doctors_clinicId_fkey";
            columns: ["clinicId"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      patients: {
        Row: {
          address: string | null;
          age: number | null;
          clinicId: string;
          createdAt: string;
          email: string | null;
          id: string;
          name: string;
          patientId: string;
          phone: string;
          sex: Database["public"]["Enums"]["Sex"] | null;
          updatedAt: string;
        };
        Insert: {
          address?: string | null;
          age?: number | null;
          clinicId: string;
          createdAt?: string;
          email?: string | null;
          id: string;
          name: string;
          patientId: string;
          phone: string;
          sex?: Database["public"]["Enums"]["Sex"] | null;
          updatedAt: string;
        };
        Update: {
          address?: string | null;
          age?: number | null;
          clinicId?: string;
          createdAt?: string;
          email?: string | null;
          id?: string;
          name?: string;
          patientId?: string;
          phone?: string;
          sex?: Database["public"]["Enums"]["Sex"] | null;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patients_clinicId_fkey";
            columns: ["clinicId"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          appointmentId: string;
          clinicId: string;
          createdAt: string;
          id: string;
          method: Database["public"]["Enums"]["PaymentMethod"];
          notes: string | null;
          paidAt: string;
          recordedById: string;
        };
        Insert: {
          amount: number;
          appointmentId: string;
          clinicId: string;
          createdAt?: string;
          id: string;
          method: Database["public"]["Enums"]["PaymentMethod"];
          notes?: string | null;
          paidAt?: string;
          recordedById: string;
        };
        Update: {
          amount?: number;
          appointmentId?: string;
          clinicId?: string;
          createdAt?: string;
          id?: string;
          method?: Database["public"]["Enums"]["PaymentMethod"];
          notes?: string | null;
          paidAt?: string;
          recordedById?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_appointmentId_fkey";
            columns: ["appointmentId"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_clinicId_fkey";
            columns: ["clinicId"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_recordedById_fkey";
            columns: ["recordedById"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          createdAt: string;
          email: string;
          id: string;
          name: string;
        };
        Insert: {
          createdAt?: string;
          email: string;
          id: string;
          name: string;
        };
        Update: {
          createdAt?: string;
          email?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      prescriptions: {
        Row: {
          advice: string | null;
          appointmentId: string;
          clinicId: string;
          createdAt: string;
          diagnosis: string;
          id: string;
          medications: NonNullable<Json>;
          nextVisitDate: string | null;
          prescribedById: string;
          prescriptionId: string;
          treatmentPlan: string | null;
          updatedAt: string;
        };
        Insert: {
          advice?: string | null;
          appointmentId: string;
          clinicId: string;
          createdAt?: string;
          diagnosis: string;
          id: string;
          medications: NonNullable<Json>;
          nextVisitDate?: string | null;
          prescribedById: string;
          prescriptionId: string;
          treatmentPlan?: string | null;
          updatedAt: string;
        };
        Update: {
          advice?: string | null;
          appointmentId?: string;
          clinicId?: string;
          createdAt?: string;
          diagnosis?: string;
          id?: string;
          medications?: NonNullable<Json>;
          nextVisitDate?: string | null;
          prescribedById?: string;
          prescriptionId?: string;
          treatmentPlan?: string | null;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointmentId_fkey";
            columns: ["appointmentId"];
            isOneToOne: true;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prescriptions_clinicId_fkey";
            columns: ["clinicId"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prescriptions_prescribedById_fkey";
            columns: ["prescribedById"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      printable_templates: {
        Row: {
          clinicId: string;
          content: string;
          createdAt: string;
          id: string;
          showPatientDetails: boolean;
          templateType: Database["public"]["Enums"]["TemplateType"];
          title: string;
          updatedAt: string;
        };
        Insert: {
          clinicId: string;
          content: string;
          createdAt?: string;
          id: string;
          showPatientDetails?: boolean;
          templateType?: Database["public"]["Enums"]["TemplateType"];
          title: string;
          updatedAt: string;
        };
        Update: {
          clinicId?: string;
          content?: string;
          createdAt?: string;
          id?: string;
          showPatientDetails?: boolean;
          templateType?: Database["public"]["Enums"]["TemplateType"];
          title?: string;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "printable_templates_clinicId_fkey";
            columns: ["clinicId"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _next_daily_serial_id: {
        Args: { p_max_existing: number; p_prefix: string };
        Returns: string;
      };
      bulk_delete_appointments: { Args: { p_clinic_id: string; p_ids: string[] }; Returns: number };
      confirm_appointment: {
        Args: {
          p_allow_override?: boolean;
          p_appointment_data: Json;
          p_clinic_id: string;
          p_id: string;
          p_patient_data: Json;
        };
        Returns: {
          adminUserId: string | null;
          appointmentId: string;
          bookingChannel: Database["public"]["Enums"]["BookingChannel"];
          clinicId: string;
          createdAt: string;
          doctorId: string | null;
          id: string;
          notes: string | null;
          patientId: string;
          preferredDateTime: string;
          priority: Database["public"]["Enums"]["AppointmentPriority"] | null;
          reasonForVisit: string | null;
          status: Database["public"]["Enums"]["AppointmentStatus"];
          submittedBy: Database["public"]["Enums"]["SubmissionSource"];
          totalAmount: number | null;
          type: Database["public"]["Enums"]["AppointmentType"] | null;
          updatedAt: string;
          visitType: Database["public"]["Enums"]["VisitType"];
        };
        SetofOptions: {
          from: "*";
          to: "appointments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_appointment_atomic: {
        Args: { p_allow_override: boolean; p_clinic_id: string; p_data: Json; p_timezone: string };
        Returns: {
          adminUserId: string | null;
          appointmentId: string;
          bookingChannel: Database["public"]["Enums"]["BookingChannel"];
          clinicId: string;
          createdAt: string;
          doctorId: string | null;
          id: string;
          notes: string | null;
          patientId: string;
          preferredDateTime: string;
          priority: Database["public"]["Enums"]["AppointmentPriority"] | null;
          reasonForVisit: string | null;
          status: Database["public"]["Enums"]["AppointmentStatus"];
          submittedBy: Database["public"]["Enums"]["SubmissionSource"];
          totalAmount: number | null;
          type: Database["public"]["Enums"]["AppointmentType"] | null;
          updatedAt: string;
          visitType: Database["public"]["Enums"]["VisitType"];
        };
        SetofOptions: {
          from: "*";
          to: "appointments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_prescription_with_id: {
        Args: { p_clinic_id: string; p_data: Json; p_timezone: string };
        Returns: {
          advice: string | null;
          appointmentId: string;
          clinicId: string;
          createdAt: string;
          diagnosis: string;
          id: string;
          medications: NonNullable<Json>;
          nextVisitDate: string | null;
          prescribedById: string;
          prescriptionId: string;
          treatmentPlan: string | null;
          updatedAt: string;
        };
        SetofOptions: {
          from: "*";
          to: "prescriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_patients: { Args: { p_clinic_id: string; p_ids: string[] }; Returns: number };
      find_or_create_patient: {
        Args: {
          p_clinic_id: string;
          p_clinic_short_name: string;
          p_data: Json;
          p_timezone: string;
        };
        Returns: {
          id: string;
          isNew: boolean;
          patientId: string;
        }[];
      };
      get_dashboard_stats: {
        Args: { p_clinic_id: string; p_today_start: string; p_tomorrow_start: string };
        Returns: {
          patients_seen_today: number;
          pending_confirmations: number;
          today_appointments: number;
          total_patients: number;
        }[];
      };
      get_platform_clinic_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          adminCount: number;
          appointmentCount: number;
          createdAt: string;
          email: string;
          id: string;
          isActive: boolean;
          lastAppointmentAt: string;
          name: string;
          patientCount: number;
          phones: string[];
          shortName: string;
          slug: string;
        }[];
      };
      search_patients: {
        Args: { p_clinic_id: string; p_search?: string };
        Returns: {
          address: string;
          age: number;
          createdAt: string;
          email: string;
          id: string;
          lastVisit: string;
          name: string;
          patientId: string;
          phone: string;
          sex: Database["public"]["Enums"]["Sex"];
          totalVisits: number;
        }[];
      };
      update_appointment_atomic: {
        Args: { p_allow_override?: boolean; p_clinic_id: string; p_data: Json; p_id: string };
        Returns: {
          adminUserId: string | null;
          appointmentId: string;
          bookingChannel: Database["public"]["Enums"]["BookingChannel"];
          clinicId: string;
          createdAt: string;
          doctorId: string | null;
          id: string;
          notes: string | null;
          patientId: string;
          preferredDateTime: string;
          priority: Database["public"]["Enums"]["AppointmentPriority"] | null;
          reasonForVisit: string | null;
          status: Database["public"]["Enums"]["AppointmentStatus"];
          submittedBy: Database["public"]["Enums"]["SubmissionSource"];
          totalAmount: number | null;
          type: Database["public"]["Enums"]["AppointmentType"] | null;
          updatedAt: string;
          visitType: Database["public"]["Enums"]["VisitType"];
        };
        SetofOptions: {
          from: "*";
          to: "appointments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      AppointmentPriority: "ROUTINE" | "URGENT" | "EMERGENCY";
      AppointmentStatus:
        | "TENTATIVE"
        | "CONFIRMED"
        | "COMPLETED"
        | "CANCELLED"
        | "PENDING"
        | "OVERDUE";
      AppointmentType: "PATIENT_BOOKING" | "WALK_IN" | "FOLLOW_UP";
      BookingChannel: "ONLINE" | "PHONE" | "WALK_IN" | "SMS" | "WHATSAPP";
      PaymentMethod: "CASH" | "UPI" | "CARD" | "WAIVED" | "OTHER";
      Sex: "MALE" | "FEMALE" | "OTHER";
      SubmissionSource: "PATIENT" | "ADMIN";
      TemplateType: "DOCUMENT" | "SURVEY";
      VisitType: "NEW_CONSULTATION" | "FOLLOW_UP";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      AppointmentPriority: ["ROUTINE", "URGENT", "EMERGENCY"],
      AppointmentStatus: ["TENTATIVE", "CONFIRMED", "COMPLETED", "CANCELLED", "PENDING", "OVERDUE"],
      AppointmentType: ["PATIENT_BOOKING", "WALK_IN", "FOLLOW_UP"],
      BookingChannel: ["ONLINE", "PHONE", "WALK_IN", "SMS", "WHATSAPP"],
      PaymentMethod: ["CASH", "UPI", "CARD", "WAIVED", "OTHER"],
      Sex: ["MALE", "FEMALE", "OTHER"],
      SubmissionSource: ["PATIENT", "ADMIN"],
      TemplateType: ["DOCUMENT", "SURVEY"],
      VisitType: ["NEW_CONSULTATION", "FOLLOW_UP"],
    },
  },
} as const;
