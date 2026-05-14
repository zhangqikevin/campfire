import { AccountsList } from "@/components/admin/AccountsList";

export const metadata = {
  title: "Accounts · Admin · Campfire",
};

export default async function AccountsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Accounts</h2>
        <p className="text-sm text-fg-muted">
          Each account has one OpenClaw gateway binding, pre-provisioned here.
        </p>
      </div>
      <AccountsList />
    </div>
  );
}
