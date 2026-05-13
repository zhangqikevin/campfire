import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid = false, className = "", ...props }: InputProps) {
  return (
    <input
      className={`block h-10 w-full rounded-md border bg-bg px-3 text-sm text-fg placeholder:text-fg-subtle transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${
        invalid ? "border-danger" : "border-border"
      } ${className}`}
      {...props}
    />
  );
}
