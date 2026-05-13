import type { LabelHTMLAttributes, ReactNode } from "react";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

export function Label({ className = "", children, ...props }: LabelProps) {
  return (
    <label
      className={`block text-sm font-medium text-fg ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
