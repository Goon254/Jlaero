import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav className="mb-8 flex items-center justify-between text-sm">
        <Link href="/" className="text-lg font-semibold">
          Jl<span className="text-gold">aero</span>
          <span className="ml-2 rounded bg-red-900/60 px-2 py-0.5 text-xs text-red-300">
            admin
          </span>
        </Link>
        <div className="flex gap-5">
          <Link href="/admin" className="hover:text-gold">Overview</Link>
          <Link href="/desk" className="hover:text-gold">Broker desk</Link>
          <Link href="/admin/verifications" className="hover:text-gold">Verifications</Link>
          <Link href="/admin/services" className="hover:text-gold">Services</Link>
          <Link href="/admin/users" className="hover:text-gold">Users</Link>
          <Link href="/admin/listings" className="hover:text-gold">Listings</Link>
          <Link href="/admin/bookings" className="hover:text-gold">Bookings</Link>
          <Link href="/admin/audit" className="hover:text-gold">Audit</Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
