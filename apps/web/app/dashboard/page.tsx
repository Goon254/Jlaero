import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // First-time users (no name yet) go finish onboarding.
  if (!user.profile?.full_name) redirect("/onboarding");

  const isOwner = user.roles.includes("owner");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome, {user.profile.full_name}
          </h1>
          <p className="text-sm text-slate-400">
            {user.email} ·{" "}
            <span className="text-gold">{user.roles.join(", ") || "traveler"}</span>
            {" · "}
            <span className="capitalize">{user.profile.verification}</span>
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-gold hover:text-gold">
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Card title="Charter a jet" href="/charter" body="Search and request private jets." />
        <Card title="Aviation services" href="/services" body="Hangars, FBO services, detailing, and more." />
        <Card title="Aircraft for sale" href="/marketplace" body="Browse jets for sale." />
        <Card title="My bookings" href="/bookings" body="Track your requests and trips." />
        {isOwner && (
          <Card title="My aircraft" href="/owner/aircraft" body="Manage your fleet and sale listings." />
        )}
        {isOwner && (
          <Card title="Booking requests" href="/owner/requests" body="Respond to incoming charters." />
        )}
      </section>

      {!isOwner && (
        <p className="mt-8 text-sm text-slate-400">
          Operate aircraft?{" "}
          <Link href="/onboarding" className="text-gold">
            Switch to an operator account
          </Link>
          .
        </p>
      )}
    </main>
  );
}

function Card({ title, href, body }: { title: string; href: string; body: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-800 bg-ink-soft p-6 transition hover:border-gold"
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{body}</p>
    </Link>
  );
}
