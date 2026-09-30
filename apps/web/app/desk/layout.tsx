import Link from "next/link";
import { Bell } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { Brand } from "@/components/lux/Brand";
import { DeskNav } from "./DeskNav";

export const metadata = { title: "Broker desk | Jlaero" };

// Broker / finance / admin dashboard (spec s22-s23, blueprint s2).
export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff("view");
  const [row] = await db()`select count(*)::int as unread from notifications
    where user_id = ${user.id} and channel = 'app' and read_at is null`;
  const unread = Number(row?.unread ?? 0);
  const role = user.isAdmin ? "Admin" : user.isBroker && user.isFinance ? "Broker + Finance" : user.isBroker ? "Broker" : "Finance";
  const links = [
    { href: "/desk", label: "Dashboard", show: true },
    { href: "/desk/trips", label: "Trips", show: true },
    { href: "/desk/payments", label: "Payments", show: user.isFinance || user.isBroker },
    { href: "/desk/clients", label: "Clients", show: user.isBroker },
    { href: "/desk/operators", label: "Operators", show: user.isBroker },
    { href: "/desk/inbox", label: "Inbox", show: user.isBroker },
    { href: "/desk/feedback", label: "Feedback", show: true },
    { href: "/desk/settings", label: "Settings", show: user.isAdmin },
  ].filter((l) => l.show).map(({ href, label }) => ({ href, label }));

  return (
    <div className="lux min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
          <Brand href="/desk" suffix="Desk" />
          <DeskNav links={links} />
          <div className="ml-auto flex items-center gap-3">
            <Link href="/desk/notifications" className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-fg-2 hover:bg-neutral-soft hover:text-fg" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-bad px-1 text-center text-[11px] font-bold leading-[18px] text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <div className="hidden text-right text-xs sm:block">
              <p className="font-semibold text-fg">{user.profile?.full_name ?? user.email}</p>
              <p className="text-fg-3">{role}</p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
