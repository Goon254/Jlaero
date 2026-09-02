import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { SettingsForms } from "./SettingsForms";

export default async function Settings() {
  const user = await requireUser();

  return (
    <PageShell title="Settings" subtitle={user.email ?? ""}>
      <div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_260px]">
        <SettingsForms
          profile={{
            full_name: user.profile?.full_name ?? "",
            company_name: user.profile?.company_name ?? "",
            home_base: user.profile?.home_base ?? "",
          }}
        />
        <aside className="space-y-3 text-sm">
          <Link href="/settings/payments" className="block rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 hover:border-gold">
            Payments & payouts
          </Link>
          <Link href="/settings/notifications" className="block rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 hover:border-gold">
            Notifications
          </Link>
          <Link href="/favorites" className="block rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 hover:border-gold">
            Saved listings
          </Link>
          <Link href="/settings/delete-account" className="block rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 text-red-400 hover:border-red-700">
            Delete account
          </Link>
        </aside>
      </div>
    </PageShell>
  );
}
