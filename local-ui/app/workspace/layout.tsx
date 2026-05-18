import Link from "next/link";
import { GatewayScope } from "@local/components/GatewayScope";
import { LocalNav } from "@local/components/LocalNav";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <GatewayScope>
      <div className="min-h-dvh">
        <header className="border-b border-border bg-bg-subtle">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <Link href="/workspace/" className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-sm bg-accent" aria-hidden />
              <span className="text-sm font-semibold tracking-tight">Campfire</span>
            </Link>
            <span className="text-xs text-fg-muted">
              local mode
              {process.env["NEXT_PUBLIC_CAMPFIRE_VERSION"] ? (
                <span className="ml-2 font-mono text-fg-subtle">
                  {process.env["NEXT_PUBLIC_CAMPFIRE_VERSION"]}
                </span>
              ) : null}
            </span>
          </div>
        </header>
        <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
          <LocalNav />
          {children}
        </div>
      </div>
    </GatewayScope>
  );
}
