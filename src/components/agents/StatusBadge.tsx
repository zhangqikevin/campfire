interface StatusBadgeProps {
  verified: boolean;
  title?: string;
}

export function StatusBadge({ verified, title }: StatusBadgeProps) {
  const styles = verified
    ? "bg-accent/15 text-accent border-accent/40"
    : "bg-bg-inset text-fg-muted border-border";
  const label = verified ? "Reachable" : "Not verified";
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}
