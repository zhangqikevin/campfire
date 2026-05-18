import Link from "next/link";
import { AppDetailView } from "@/components/apps/AppDetailView";

interface PageProps {
  params: Promise<{ appId: string }>;
}

export default async function WorkspaceAppDetailPage({ params }: PageProps) {
  const { appId } = await params;
  return (
    <div className="space-y-4">
      <Link href="/workspace/apps" className="text-xs text-fg-muted hover:text-fg">
        ← Apps
      </Link>
      <AppDetailView appId={appId} />
    </div>
  );
}
