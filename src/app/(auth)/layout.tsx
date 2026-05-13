import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="h-6 w-6 rounded-sm bg-accent" aria-hidden />
        <span className="text-base font-semibold tracking-tight">Campfire</span>
      </Link>
      <div className="w-full max-w-sm rounded-lg border border-border bg-bg-subtle p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
