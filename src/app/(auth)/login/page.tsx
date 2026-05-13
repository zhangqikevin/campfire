import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Log in · Campfire",
};

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { from } = await searchParams;
  const redirectTo = from && from.startsWith("/") && !from.startsWith("//") ? from : undefined;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-fg-muted">Log in to your Campfire.</p>
      </div>
      <LoginForm redirectTo={redirectTo} />
    </>
  );
}
