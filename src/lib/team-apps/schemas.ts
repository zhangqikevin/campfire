import { z } from "zod";

const titleField = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(120, "Title is too long");

const descriptionField = z
  .string()
  .trim()
  .max(500, "Description is too long")
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const contentField = z
  .string()
  .min(1, "Content is required")
  .max(200_000, "Content is too large");

export const createTeamAppSchema = z.object({
  title: titleField,
  description: descriptionField,
  content: contentField,
  enabled: z.boolean().optional().default(true),
});

export const updateTeamAppSchema = createTeamAppSchema.extend({
  id: z.string().uuid("Invalid team app id"),
});

export type CreateTeamAppInput = z.infer<typeof createTeamAppSchema>;
export type UpdateTeamAppInput = z.infer<typeof updateTeamAppSchema>;
