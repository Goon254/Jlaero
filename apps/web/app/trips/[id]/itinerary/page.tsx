import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ItineraryContent } from "@/lib/trips/workflow";
import { ClientShell } from "@/components/lux/ClientShell";
import { ItineraryDocument } from "@/components/lux/ItineraryDocument";
import { PrintButton } from "@/components/lux/PrintButton";
import { EmptyState } from "@/components/lux/ui";
import { loadClientSettings } from "../../_lib/data";

export const metadata = { title: "Itinerary | Jlaero" };

// Company-branded itinerary (spec s13). Clients only ever see the current
// published version; history stays with the broker (blueprint s23).
export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/trips/${id}/itinerary`);
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, trip_number, client_id").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const [{ data: it }, { data: client }, settings] = await Promise.all([
    supabase.from("client_itineraries").select("version, content, change_summary, published_at").eq("trip_id", id).eq("status", "published").maybeSingle(),
    supabase.from("clients").select("full_name").eq("id", trip.client_id).maybeSingle(),
    loadClientSettings(),
  ]);

  return (
    <ClientShell>
      <nav aria-label="Breadcrumb" className="no-print mb-6 text-sm text-fg-3">
        <Link href="/trips" className="hover:text-fg">My trips</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/trips/${id}`} className="hover:text-fg">{trip.trip_number}</Link> <span aria-hidden>/</span> <span className="text-fg-2">Itinerary</span>
      </nav>
      {!it ? (
        <EmptyState title="Your itinerary is being prepared" body="We will notify you as soon as it is ready." />
      ) : (
        <div className="space-y-4">
          <div className="no-print flex justify-end"><PrintButton /></div>
          <ItineraryDocument
            content={it.content as ItineraryContent}
            company={{
              name: settings.company.name,
              support_email: settings.company.support_email ?? "",
              support_phone: settings.company.support_phone ?? "",
              address: settings.company.address ?? "",
            }}
            tripNumber={trip.trip_number}
            version={it.version}
            changeSummary={it.change_summary}
            clientName={client?.full_name ?? null}
            publishedAt={it.published_at}
          />
        </div>
      )}
    </ClientShell>
  );
}
