import Link from "next/link";
import { CreateAccountForm } from "@/components/admin/CreateAccountForm";

export const metadata = {
  title: "New account · Admin · Campfire",
};

export default function NewAccountPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/accounts" className="text-xs text-fg-muted hover:text-fg">
        ← Accounts
      </Link>
      <div>
        <h2 className="text-base font-semibold">Create account</h2>
        <p className="text-sm text-fg-muted">
          Provisions the user + their tenant + a gateway binding (with encrypted token) in one transaction.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-bg-subtle p-6">
        <CreateAccountForm />
      </div>
    </div>
  );
}
