import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("owner");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <nav className="mb-8 flex items-center justify-between text-sm">
        <Link href="/" className="text-lg font-semibold">
          Jl<span className="text-gold">aero</span>
        </Link>
        <div className="flex gap-5">
          <Link href="/owner" className="hover:text-gold">Overview</Link>
          <Link href="/owner/aircraft" className="hover:text-gold">My aircraft</Link>
          <Link href="/owner/documents" className="hover:text-gold">Documents</Link>
          <Link href="/dashboard" className="hover:text-gold">Dashboard</Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
