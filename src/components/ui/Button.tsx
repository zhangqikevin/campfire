import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:opacity-90 active:opacity-80 disabled:opacity-50",
  secondary:
    "bg-bg-inset text-fg hover:bg-bg-subtle border border-border disabled:opacity-50",
  ghost: "bg-transparent text-fg hover:bg-bg-subtle disabled:opacity-50",
};

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
