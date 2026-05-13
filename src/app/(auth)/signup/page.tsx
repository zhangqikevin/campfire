import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = {
  title: "Sign up · Campfire",
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-fg-muted">It only takes a moment.</p>
      </div>
      <SignupForm />
    </>
  );
}
