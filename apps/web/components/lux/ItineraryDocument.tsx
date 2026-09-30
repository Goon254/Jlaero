// Company-branded client itinerary (spec s13; blueprint s22-s23). Print-ready:
// browsers save it as a PDF. Shared by the desk preview and the client page.
import type { ItineraryContent } from "@/lib/trips/workflow";

export function ItineraryDocument({ content, company, tripNumber, version, changeSummary, clientName, publishedAt }: {
  content: ItineraryContent; company: { name: string; support_email: string; support_phone: string; address: string };
  tripNumber: string; version: number; changeSummary?: string | null; clientName?: string | null; publishedAt?: string | Date | null;
}) {
  return (
    <article className="print-sheet rounded-2xl border border-line bg-surface p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="font-display text-3xl font-semibold tracking-tight">{company.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-fg-3">Trip itinerary</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{tripNumber}</p>
          <p className="text-fg-2">Version {version}{publishedAt ? ` · ${new Date(publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}</p>
          {clientName && <p className="text-fg-2">Prepared for {clientName}</p>}
        </div>
      </header>
      {version > 1 && changeSummary && (
        <p className="mt-6 rounded-xl bg-accent-soft px-4 py-3 text-sm"><span className="font-semibold">Updated:</span> {changeSummary}</p>
      )}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div><p className="text-xs uppercase tracking-wider text-fg-3">Aircraft</p><p className="mt-1 font-semibold">{content.aircraft}</p>{content.tail_number && <p className="text-sm text-fg-2">{content.tail_number}</p>}</div>
        <div><p className="text-xs uppercase tracking-wider text-fg-3">Operated by</p><p className="mt-1 font-semibold">{content.operator}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-fg-3">Passengers</p><p className="mt-1 font-semibold">{content.passengers}</p></div>
      </section>
      <section className="mt-8 space-y-4">
        {content.legs.map((l, i) => (
          <div key={i} className="rounded-xl border border-line p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wider text-fg-3">Flight {i + 1}{l.flight_time ? ` · ${l.flight_time}` : ""}</p>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-display text-2xl font-semibold">{l.from}</p>
                <p className="text-sm">{l.depart_local}</p>
                {l.from_fbo && <p className="text-sm text-fg-2">{l.from_fbo}</p>}
              </div>
              <div className="sm:text-right">
                <p className="font-display text-2xl font-semibold">{l.to}</p>
                {l.arrive_local && <p className="text-sm">{l.arrive_local}</p>}
                {l.to_fbo && <p className="text-sm text-fg-2">{l.to_fbo}</p>}
              </div>
            </div>
          </div>
        ))}
      </section>
      <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
        {content.crew && <div><dt className="text-fg-3">Crew</dt><dd>{content.crew}</dd></div>}
        {content.catering && <div><dt className="text-fg-3">Catering</dt><dd>{content.catering}</dd></div>}
        {content.ground_transport && <div><dt className="text-fg-3">Ground transportation</dt><dd>{content.ground_transport}</dd></div>}
        {content.contacts && <div><dt className="text-fg-3">Contacts</dt><dd>{content.contacts}</dd></div>}
      </dl>
      {content.notes && <p className="mt-6 whitespace-pre-wrap text-sm">{content.notes}</p>}
      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-3">
        {company.name}{company.address ? ` · ${company.address}` : ""} · {company.support_phone || company.support_email}
        <br />
        {company.name} is an air charter broker and not a direct air carrier. This flight is operated by {content.operator}, which holds operational control under its FAA Part 135 certificate.
      </footer>
    </article>
  );
}
