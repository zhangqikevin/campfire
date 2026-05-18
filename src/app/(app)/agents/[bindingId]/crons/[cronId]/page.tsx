import Link from "next/link";
import { CronDetailView } from "@/components/crons/CronDetailView";

interface PageProps {
  params: Promise<{ bindingId: string; cronId: string }>;
}

export default async function CronDetailPage({ params }: PageProps) {
  const { bindingId, cronId } = await params;
  return (
    <div className="space-y-4">
      <Link
        href={`/agents/${bindingId}/crons`}
        className="text-xs text-fg-muted hover:text-fg"
      >
        ← Crons
      </Link>
      <CronDetailView cronId={cronId} listHref={`/agents/${bindingId}/crons`} />
    </div>
  );
}
