import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { DeleteForm } from "./DeleteForm";

export default async function DeleteAccount() {
  await requireUser();

  return (
    <PageShell title="Delete account">
      <div className="max-w-md">
        <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6">
          <h2 className="font-semibold text-red-300">This is permanent</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            <li>Your profile is anonymized and your login is disabled.</li>
            <li>Uploaded verification documents are deleted.</li>
            <li>
              Completed bookings and reviews remain (anonymized) because the
              other party keeps their history and payment records.
            </li>
            <li>Active bookings must be completed or cancelled first.</li>
          </ul>
          <DeleteForm />
        </div>
      </div>
    </PageShell>
  );
}
