"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: Array<{ label: string; href: string; match: string }> = [
  { label: "Apps", href: "/workspace/apps", match: "/workspace/apps" },
  { label: "Artifacts", href: "/workspace/artifacts", match: "/workspace/artifacts" },
  { label: "Crons", href: "/workspace/crons", match: "/workspace/crons" },
  { label: "Files", href: "/workspace/files", match: "/workspace/files" },
];

export function WorkspaceSideNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="space-y-1">
      {/* Agent is the middle column — clicking it does nothing by design.
          Rendered as a non-link so it's clear it isn't navigation. */}
      <button
        type="button"
        onClick={(e) => e.preventDefault()}
        className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-fg-muted"
      >
        Agent
      </button>
      {LINKS.map((item) => {
        const active = pathname.startsWith(item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-bg-inset text-fg"
                : "text-fg-muted hover:bg-bg-inset/60 hover:text-fg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
