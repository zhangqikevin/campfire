import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campfire",
  description:
    "Bring your own agent. Render its output as live, interactive UI — charts, tables, dashboards.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
