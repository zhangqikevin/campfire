import Link from "next/link";
import { AppDetailView } from "@/components/apps/AppDetailView";

interface PageProps {
  params: Promise<{ bindingId: string; appId: string }>;
}

export default async function AppDetailPage({ params }: PageProps) {
  const { bindingId, appId } = await params;
  return (
    <div className="space-y-4">
      <Link
        href={`/agents/${bindingId}/apps`}
        className="text-xs text-fg-muted hover:text-fg"
      >
        ← Apps
      </Link>
      <AppDetailView appId={appId} />
    </div>
  );
}
