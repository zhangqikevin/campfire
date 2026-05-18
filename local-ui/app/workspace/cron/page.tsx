"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CronDetailView } from "@/components/crons/CronDetailView";

export const dynamic = "force-static";

function CronFromSearch() {
  const params = useSearchParams();
  const id = params?.get("id");
  if (!id) return <p className="text-sm text-fg-muted">Missing cron id.</p>;
  return (
    <div className="space-y-4">
      <Link href="/workspace/crons/" className="text-xs text-fg-muted hover:text-fg">
        ← Crons
      </Link>
      <CronDetailView cronId={id} listHref="/workspace/crons/" />
    </div>
  );
}

export default function CronDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-fg-muted">Loading…</p>}>
      <CronFromSearch />
    </Suspense>
  );
}
