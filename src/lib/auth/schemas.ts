import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email");

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required").max(128),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
