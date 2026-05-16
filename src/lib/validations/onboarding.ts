import { z } from "zod/v4";

export const slugSchema = z
  .string()
  .min(3, "Minimum 3 characters")
  .max(30, "Maximum 30 characters")
  .regex(
    /^[a-z][a-z0-9-]*[a-z0-9]$/,
    "Lowercase letters, numbers, and hyphens only — must start and end with a letter or number"
  )
  .refine((s) => !s.includes("--"), "Cannot contain consecutive hyphens");

export const shortNameSchema = z
  .string()
  .min(2, "Minimum 2 characters")
  .max(8, "Maximum 8 characters")
  .regex(/^[A-Z][A-Z0-9]*$/, "Uppercase letters and numbers only");

export const registerClinicSchema = z.object({
  clinic: z.object({
    name: z.string().min(2, "Clinic name is required").max(100),
    shortName: shortNameSchema,
    slug: slugSchema,
    timezone: z.string().default("Asia/Kolkata"),
    address: z
      .object({
        line1: z.string().min(1, "Street address is required"),
        line2: z.string().optional(),
        city: z.string().min(1, "City is required"),
        state: z.string().min(1, "State is required"),
        pincode: z.string().regex(/^\d{6}$/, "Must be a 6-digit pincode"),
      })
      .optional(),
    phones: z
      .array(
        z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
      )
      .min(1, "At least one phone number is required")
      .max(3),
    email: z.email("Enter a valid email").optional().or(z.literal("")),
    website: z.url("Enter a valid URL (include https://)").optional().or(z.literal("")),
    logo: z.string().optional(),
  }),
  admin: z.object({
    name: z.string().min(2, "Name is required").max(100),
    email: z.email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

export type RegisterClinicInput = z.infer<typeof registerClinicSchema>;
