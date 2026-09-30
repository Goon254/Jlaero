import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { ButtonLink, Card, DefinitionList, EmptyState, PageHeader, Pill } from "@/components/lux/ui";
import { Tabs, qs, shortDateTime } from "../_lib/table";

export const metadata = { title: "Inbox | Jlaero Desk" };

type Parsed = {
  client_name?: string | null; company_name?: string | null; phone?: string | null;
  origin?: string | null; origin_icao_guess?: string | null; destination?: string | null; destination_icao_guess?: string | null;
  departure_date?: string | null; departure_time?: string | null; return_date?: string | null; return_time?: string | null;
  passengers?: number | null; aircraft_type?: string | null; vehicle_required?: boolean | null; catering_required?: boolean | null;
  special_requests?: string | null; missing_information?: string[];
};

const yesNo = (v: boolean | null | undefined) => (v == null ? "Not said" : v ? "Yes" : "No");

// Inbound email that did not land on an RFQ thread: client trip requests
// read by the AI request parser, and anything unmatched (spec s3 option A).
export default async function DeskInbox({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireStaff("broker");
  const { view } = await searchParams;
  const tab = view === "unmatched" ? "unmatched" : view === "all" ? "all" : "requests";
  const sql = db();
  const rows = await sql`
    select m.id, m.from_address, m.to_address, m.subject, m.text_body, m.received_at, m.created_at, m.classification,
           t.id as trip_id, t.trip_number
    from rfq_messages m
    left join trips t on t.source_email_id = m.id
    where m.direction = 'inbound'
      and ${tab === "requests"
        ? sql`m.classification->>'kind' = 'trip_request'`
        : tab === "unmatched"
          ? sql`m.recipient_id is null and coalesce(m.classification->>'kind', '') <> 'trip_request'`
          : sql`(m.recipient_id is null or m.classification->>'kind' = 'trip_request')`}
    order by coalesce(m.received_at, m.created_at) desc
    limit 100`;

  return (
    <>
      <PageHeader eyebrow="Communications" title="Inbox" subtitle="Trip requests clients emailed in, and operator email that did not match an RFQ." />
      <Tabs
        active={tab}
        items={[
          { key: "requests", label: "Trip requests", href: `/desk/inbox${qs({}, {})}` },
          { key: "unmatched", label: "Unmatched", href: `/desk/inbox${qs({}, { view: "unmatched" })}` },
          { key: "all", label: "All", href: `/desk/inbox${qs({}, { view: "all" })}` },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState title="Inbox is clear" body="Emails to the requests address are read by AI and turned into trips here." />
      ) : (
        <div className="space-y-3">
          {rows.map((m) => {
            const cls = (m.classification ?? {}) as { kind?: string; parsed?: Parsed; reason?: string };
            const p = cls.parsed;
            const isRequest = cls.kind === "trip_request";
            return (
              <Card key={m.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{m.subject || "(no subject)"}</p>
                    <p className="break-all text-sm text-fg-2">From {m.from_address} · {shortDateTime(m.received_at ?? m.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isRequest ? <Pill tone="accent">Trip request · AI read</Pill> : <Pill>{cls.kind ? cls.kind.replace(/_/g, " ") : "Unclassified"}</Pill>}
                    {m.trip_id ? (
                      <ButtonLink href={`/desk/trips/${m.trip_id}`} variant="secondary">Open {m.trip_number}</ButtonLink>
                    ) : (
                      <ButtonLink href={`/desk/trips/new?message=${m.id}`}>Create trip</ButtonLink>
                    )}
                  </div>
                </div>
                {p ? (
                  <div className="mt-4 grid gap-6 md:grid-cols-2">
                    <DefinitionList items={[
                      ["Client", [p.client_name, p.company_name].filter(Boolean).join(", ") || "Not said"],
                      ["Phone", p.phone ?? "Not said"],
                      ["From", p.origin_icao_guess ? `${p.origin} (${p.origin_icao_guess})` : p.origin ?? "Missing"],
                      ["To", p.destination_icao_guess ? `${p.destination} (${p.destination_icao_guess})` : p.destination ?? "Missing"],
                      ["Departure", [p.departure_date, p.departure_time].filter(Boolean).join(" ") || "Missing"],
                      ["Return", [p.return_date, p.return_time].filter(Boolean).join(" ") || "One way"],
                    ]} />
                    <DefinitionList items={[
                      ["Passengers", p.passengers ?? "Missing"],
                      ["Aircraft", p.aircraft_type ?? "Any"],
                      ["Catering", yesNo(p.catering_required)],
                      ["Vehicle", yesNo(p.vehicle_required)],
                      ["Special requests", p.special_requests ?? "None"],
                    ]} />
                    {p.missing_information && p.missing_information.length > 0 && (
                      <p className="text-sm text-warn md:col-span-2">Still needed: {p.missing_information.join(", ")}</p>
                    )}
                  </div>
                ) : (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-fg-2">Show message</summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-sunken p-3 font-sans text-sm text-fg-2">{(m.text_body ?? "").slice(0, 4000)}</pre>
                  </details>
                )}
                {!isRequest && cls.reason && <p className="mt-2 text-xs text-fg-3">AI note: {cls.reason}</p>}
                {m.trip_id == null && isRequest && (
                  <p className="mt-3 text-xs text-fg-3">
                    The AI could not create the trip automatically. <Link href={`/desk/trips/new?message=${m.id}`} className="text-accent-text underline-offset-4 hover:underline">Complete it</Link> to reply with options.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
