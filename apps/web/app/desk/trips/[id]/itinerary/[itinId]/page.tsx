import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/trips/core";
import { requireStaff } from "@/lib/trips/access";
import type { ItineraryContent } from "@/lib/trips/workflow";
import { ItineraryDocument } from "@/components/lux/ItineraryDocument";
import { PrintButton } from "@/components/lux/PrintButton";
import { Pill } from "@/components/lux/ui";

export default async function DeskItineraryPage({ params }: { params: Promise<{ id: string; itinId: string }> }) {
  const { id, itinId } = await params;
  await requireStaff("view");
  const [it] = await db()`select i.*, t.trip_number, c.full_name from client_itineraries i join trips t on t.id = i.trip_id
    join clients c on c.id = t.client_id where i.id = ${itinId} and i.trip_id = ${id}`;
  if (!it) notFound();
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link href={`/desk/trips/${id}`} className="text-sm text-fg-2 hover:text-fg">Back to trip</Link>
        <Pill tone={it.status === "published" ? "ok" : it.status === "draft" ? "warn" : "neutral"}>{it.status}</Pill>
        <span className="ml-auto"><PrintButton /></span>
      </div>
      <ItineraryDocument content={it.content as ItineraryContent} company={settings.company} tripNumber={it.trip_number} version={it.version}
        changeSummary={it.change_summary} clientName={it.full_name} publishedAt={it.published_at} />
    </div>
  );
}
