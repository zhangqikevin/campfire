import Link from "next/link";
import { notFound } from "next/navigation";
import { BindingNav } from "@/components/agents/BindingNav";
import { BindingScope } from "@/components/agents/BindingScope";
import { getBindingForTenant } from "@/lib/agent-bindings/actions";

interface BindingLayoutProps {
  params: Promise<{ bindingId: string }>;
  children: React.ReactNode;
}

export default async function BindingLayout({ params, children }: BindingLayoutProps) {
  const { bindingId } = await params;
  const binding = await getBindingForTenant(bindingId);
  if (!binding) notFound();

  return (
    <BindingScope bindingId={binding.id} url={binding.url}>
      <div className="space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Link href="/agents" className="hover:text-fg">
              Agents
            </Link>
            <span>/</span>
            <span className="text-fg">{binding.name}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{binding.name}</h1>
          <p className="font-mono text-xs text-fg-subtle">{binding.url}</p>
        </header>

        <BindingNav bindingId={binding.id} />

        <div>{children}</div>
      </div>
    </BindingScope>
  );
}
