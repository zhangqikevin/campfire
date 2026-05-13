import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-sm bg-accent" aria-hidden />
          <span className="text-base font-semibold tracking-tight">Campfire</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary">Sign up</Button>
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center pb-24 pt-12">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Bring your own agent.
          <br />
          <span className="text-fg-muted">Render its output as live UI.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base text-fg-muted">
          Campfire is a workspace for the agents you already run — OpenClaw on your laptop,
          Hermes at an endpoint you control. Chat with it, and the answers come back as
          interactive charts, tables, and dashboards instead of walls of text.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup">
            <Button variant="primary">Create an account</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">I already have one</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
