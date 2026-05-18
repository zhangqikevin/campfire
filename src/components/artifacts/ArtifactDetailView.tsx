"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useGatewayQuery } from "@/lib/agent-client/react/useGatewayQuery";
import { useClient } from "@/lib/agent-client/react/useClient";
import { ConnectionState } from "@/lib/agent-client/types";

// Markdown is rendered with classnames that target each output element
// directly (rather than depending on @tailwindcss/typography), so the look
// stays consistent with the rest of the workspace's tokens (border, bg-*,
// fg-* etc.) and doesn't pull in an extra plugin into both apps.
const MD_COMPONENTS = {
  h1: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-6 mb-3 text-2xl font-semibold tracking-tight first:mt-0" {...p} />
  ),
  h2: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-6 mb-2 text-xl font-semibold tracking-tight first:mt-0" {...p} />
  ),
  h3: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-5 mb-2 text-base font-semibold first:mt-0" {...p} />
  ),
  h4: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 className="mt-4 mb-1 text-sm font-semibold uppercase tracking-wide text-fg-muted first:mt-0" {...p} />
  ),
  p: (p: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-3 leading-7" {...p} />
  ),
  ul: (p: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-3 list-disc space-y-1 pl-6" {...p} />
  ),
  ol: (p: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-3 list-decimal space-y-1 pl-6" {...p} />
  ),
  li: (p: React.HTMLAttributes<HTMLLIElement>) => <li className="leading-7" {...p} />,
  a: (p: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-accent underline underline-offset-2 hover:opacity-90"
      target="_blank"
      rel="noreferrer noopener"
      {...p}
    />
  ),
  strong: (p: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold" {...p} />
  ),
  em: (p: React.HTMLAttributes<HTMLElement>) => <em className="italic" {...p} />,
  blockquote: (p: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-4 border-l-2 border-border pl-4 italic text-fg-muted"
      {...p}
    />
  ),
  hr: (p: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="my-6 border-border" {...p} />
  ),
  table: (p: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-4 overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm" {...p} />
    </div>
  ),
  thead: (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-bg-inset" {...p} />
  ),
  th: (p: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="border-b border-border px-3 py-2 text-left font-medium" {...p} />
  ),
  td: (p: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-border px-3 py-2 align-top" {...p} />
  ),
  code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
    const isBlock = (className ?? "").startsWith("language-");
    if (isBlock) {
      return (
        <code
          className={`block overflow-x-auto whitespace-pre rounded-md border border-border bg-bg-inset p-3 font-mono text-xs leading-relaxed text-fg ${className ?? ""}`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-bg-inset px-1 py-0.5 font-mono text-[0.85em] text-fg"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (p: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="my-3" {...p} />
  ),
};

interface ArtifactRecord {
  id: string;
  kind: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface ArtifactDetailViewProps {
  artifactId: string;
}

export function ArtifactDetailView({ artifactId }: ArtifactDetailViewProps) {
  const { state } = useClient();
  const { data, status, error } = useGatewayQuery<{ artifact: ArtifactRecord | null }>(
    "campfire.artifacts.get",
    { id: artifactId },
    artifactId,
  );

  if (state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING) {
    return (
      <p className="rounded-md border border-border bg-bg-subtle p-4 text-sm text-fg-muted">
        Not connected.
      </p>
    );
  }

  if (status === "loading" || status === "idle") return <p className="text-sm text-fg-muted">Loading…</p>;
  if (status === "error") return <p className="text-sm text-danger">{error}</p>;
  if (!data?.artifact) return <p className="text-sm text-fg-muted">Artifact not found.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{data.artifact.title || "Untitled"}</h2>
        <p className="mt-1 font-mono text-xs text-fg-subtle">
          {data.artifact.id} · {data.artifact.kind}
        </p>
      </div>
      <article className="rounded-lg border border-border bg-bg-subtle p-6 text-sm text-fg">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
          {data.artifact.content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
