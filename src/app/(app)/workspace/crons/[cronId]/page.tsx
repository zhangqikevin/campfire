import Link from "next/link";
import { CronDetailView } from "@/components/crons/CronDetailView";

interface PageProps {
  params: Promise<{ cronId: string }>;
}

export default async function WorkspaceCronDetailPage({ params }: PageProps) {
  const { cronId } = await params;
  return (
    <div className="space-y-4">
      <Link href="/workspace/crons" className="text-xs text-fg-muted hover:text-fg">
        ← Crons
      </Link>
      <CronDetailView cronId={cronId} listHref="/workspace/crons" />
    </div>
  );
}
