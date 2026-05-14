"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUserId } from "@/lib/auth/session";
import { lintOpenUICode, type LintReport } from "@/lib/lint/lint-openui";
import {
  createTeamAppSchema,
  updateTeamAppSchema,
} from "@/lib/team-apps/schemas";
import { db } from "@/lib/db";
import { teamApps, type TeamApp } from "@/lib/db/schema";

export type TeamAppFormState = {
  ok: boolean;
  errors?: Partial<Record<"title" | "description" | "content" | "form", string[]>>;
  lint?: LintReport;
  /** Echoed back so the editor can keep showing what the user typed on error. */
  values?: {
    title: string;
    description: string;
    content: string;
    enabled: boolean;
  };
};

const INITIAL: TeamAppFormState = { ok: false };

function fieldErrors(
  flat: { fieldErrors: Record<string, string[] | undefined> },
): TeamAppFormState["errors"] {
  const errs: TeamAppFormState["errors"] = {};
  for (const k of ["title", "description", "content"] as const) {
    const v = flat.fieldErrors[k];
    if (v?.length) errs[k] = v;
  }
  return errs;
}

function readFormValues(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    content: String(formData.get("content") ?? ""),
    enabled: formData.get("enabled") !== null,
  };
}

export async function createTeamAppAction(
  _prev: TeamAppFormState,
  formData: FormData,
): Promise<TeamAppFormState> {
  const { userId } = await requireAdmin();
  const values = readFormValues(formData);

  const parsed = createTeamAppSchema.safeParse(values);
  if (!parsed.success) {
    return { ...INITIAL, errors: fieldErrors(parsed.error.flatten()), values };
  }

  const lint = lintOpenUICode(parsed.data.content);

  await db.insert(teamApps).values({
    title: parsed.data.title,
    description: parsed.data.description,
    content: parsed.data.content,
    enabled: parsed.data.enabled ?? true,
    createdBy: userId,
  });

  revalidatePath("/admin/team-apps");
  // Soft-fail on lint: surface findings but still save — the admin chose to save.
  if (!lint.ok) {
    // Save happened above; redirect skipped so admin sees findings.
    return { ok: true, lint, values };
  }
  redirect("/admin/team-apps");
}

export async function updateTeamAppAction(
  _prev: TeamAppFormState,
  formData: FormData,
): Promise<TeamAppFormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const values = readFormValues(formData);

  const parsed = updateTeamAppSchema.safeParse({ id, ...values });
  if (!parsed.success) {
    return { ...INITIAL, errors: fieldErrors(parsed.error.flatten()), values };
  }

  const lint = lintOpenUICode(parsed.data.content);

  await db
    .update(teamApps)
    .set({
      title: parsed.data.title,
      description: parsed.data.description,
      content: parsed.data.content,
      enabled: parsed.data.enabled ?? true,
    })
    .where(eq(teamApps.id, parsed.data.id));

  revalidatePath("/admin/team-apps");
  revalidatePath(`/admin/team-apps/${parsed.data.id}`);
  return { ok: true, lint, values };
}

export async function deleteTeamAppAction(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  await db.delete(teamApps).where(eq(teamApps.id, id));
  revalidatePath("/admin/team-apps");
  return { ok: true };
}

/** Admin list — all team apps, newest first. */
export async function listTeamAppsForAdmin(): Promise<TeamApp[]> {
  await requireAdmin();
  return db.select().from(teamApps).orderBy(teamApps.createdAt);
}

/** Member list — enabled team apps only, available org-wide. */
export async function listTeamAppsForMember(): Promise<TeamApp[]> {
  await requireUserId();
  return db
    .select()
    .from(teamApps)
    .where(eq(teamApps.enabled, true))
    .orderBy(teamApps.createdAt);
}

export async function getTeamAppForAdmin(id: string): Promise<TeamApp | null> {
  await requireAdmin();
  const [row] = await db.select().from(teamApps).where(eq(teamApps.id, id)).limit(1);
  return row ?? null;
}

export async function getTeamAppForMember(id: string): Promise<TeamApp | null> {
  await requireUserId();
  const [row] = await db
    .select()
    .from(teamApps)
    .where(and(eq(teamApps.id, id), eq(teamApps.enabled, true)))
    .limit(1);
  return row ?? null;
}
