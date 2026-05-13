"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface BindingNavProps {
  bindingId: string;
}

const TABS: Array<{ label: string; segment: string }> = [
  { label: "Chat", segment: "chat" },
  { label: "Apps", segment: "apps" },
  { label: "Artifacts", segment: "artifacts" },
  { label: "Crons", segment: "crons" },
];

export function BindingNav({ bindingId }: BindingNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border">
      {TABS.map((tab) => {
        const href = `/agents/${bindingId}/${tab.segment}`;
        const active = pathname?.startsWith(href) ?? false;
        return (
          <Link
            key={tab.segment}
            href={href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-accent text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
