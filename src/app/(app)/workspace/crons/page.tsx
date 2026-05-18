import { notFound } from "next/navigation";
import { CronsListView } from "@/components/crons/CronsListView";
import { getPrimaryBindingForCurrentUser } from "@/lib/agent-bindings/server";

export default async function WorkspaceCronsPage() {
  const binding = await getPrimaryBindingForCurrentUser();
  if (!binding) notFound();
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Crons</h2>
      <CronsListView
        bindingId={binding.id}
        detailHrefPrefix="/workspace/crons"
      />
    </div>
  );
}
