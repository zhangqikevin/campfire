"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ label: string; href: string; match: string }> = [
  { label: "Chat", href: "/workspace/chat/", match: "/workspace/chat" },
  { label: "Apps", href: "/workspace/apps/", match: "/workspace/apps" },
  { label: "Artifacts", href: "/workspace/artifacts/", match: "/workspace/artifacts" },
];

export function LocalNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex items-center gap-1 border-b border-border">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.match);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
