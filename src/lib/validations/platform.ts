import { z } from "zod/v4";

export const updateClinicStatusSchema = z.object({
  isActive: z.boolean(),
});

const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

export const createClinicAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: passwordSchema,
});

export const setAdminPasswordSchema = z.object({
  password: passwordSchema,
});
