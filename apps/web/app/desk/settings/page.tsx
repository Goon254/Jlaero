import Link from "next/link";
import { db } from "@/lib/db";
import { markdownToHtml } from "@/lib/markdown";
import { requireStaff } from "@/lib/trips/access";
import { getSettings } from "@/lib/trips/core";
import { ActionForm } from "@/components/lux/ActionForm";
import { Card, Field, Input, PageHeader, Pill, SectionTitle, Textarea, cx } from "@/components/lux/ui";
import { shortDate } from "../_lib/table";
import { discardTemplateDraft, newTemplateVersion, publishTemplate, saveSetting, saveTemplateDraft } from "./actions";

export const metadata = { title: "Settings | Jlaero Desk" };

const PLACEHOLDERS = [
  "contract_number", "trip_number", "issued_date", "company_name", "company_legal_name", "company_address", "client_name", "client_email",
  "client_company_clause", "route", "departure", "return", "passengers", "aircraft", "operator_name", "services", "charter_price",
  "service_price_rows", "total_price", "payment_terms", "cancellation_policy", "special_requests",
];

function NumberField({ name, label, value, hint, suffix, step = "any" }: { name: string; label: string; value: number; hint?: string; suffix?: string; step?: string }) {
  return (
    <Field label={label} htmlFor={`s-${name}`} hint={hint}>
      <div className="relative">
        <Input id={`s-${name}`} name={name} type="number" step={step} defaultValue={value} className={suffix ? "pr-14" : undefined} required />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fg-3">{suffix}</span>}
      </div>
    </Field>
  );
}

// Admin settings (blueprint s34): pricing, search, automation, company,
// payment instructions, cancellation policy, versioned contract templates.
export default async function DeskSettings({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  await requireStaff("admin");
  const { template } = await searchParams;
  const s = await getSettings();
  const sql = db();
  const meta = await sql`select a.key, a.updated_at, p.full_name from app_settings a left join profiles p on p.id = a.updated_by`;
  const updated = (key: string) => {
    const m = meta.find((r) => r.key === key);
    return m ? `Last changed ${shortDate(m.updated_at)}${m.full_name ? ` by ${m.full_name}` : ""}` : undefined;
  };
  const templates = await sql`select t.*, p.full_name as author, (select count(*)::int from trip_contracts c where c.template_id = t.id) as used
    from contract_templates t left join profiles p on p.id = t.created_by order by t.version desc`;
  const selected = templates.find((t) => t.id === template) ?? templates.find((t) => t.status === "draft") ?? templates.find((t) => t.status === "active");

  return (
    <>
      <PageHeader eyebrow="Admin" title="Settings" subtitle="Pricing, search and automation rules, and the documents clients see. Changes are logged with before and after values." />

      <nav aria-label="Settings sections" className="mb-8 flex flex-wrap gap-2 text-sm">
        {[["pricing", "Pricing"], ["search", "Search"], ["automation", "Automation"], ["company", "Company"], ["payments", "Payment instructions"], ["cancellation", "Cancellation policy"], ["templates", "Contract templates"]].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="rounded-lg border border-line px-3 py-2 text-fg-2 hover:bg-raised hover:text-fg">{l}</a>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <section id="pricing">
          <SectionTitle>Pricing</SectionTitle>
          <Card>
            <p className="mb-4 text-sm text-fg-2">Client price = operator cost + markup + catering + vehicle + service fee. Brokers can lower markup to the minimum; below that needs an admin.</p>
            <ActionForm action={saveSetting} submitLabel="Save pricing">
              <input type="hidden" name="key" value="pricing" />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField name="default_markup_pct" label="Default markup" value={s.pricing.default_markup_pct} suffix="%" />
                <NumberField name="min_markup_pct" label="Minimum markup" value={s.pricing.min_markup_pct} suffix="%" />
                <NumberField name="catering_default" label="Default catering price" value={s.pricing.catering_default} suffix="USD" hint="Added when a client asks for catering and the operator does not price it." />
                <NumberField name="vehicle_default" label="Default vehicle price" value={s.pricing.vehicle_default} suffix="USD" />
                <NumberField name="service_fee" label="Service fee per trip" value={s.pricing.service_fee} suffix="USD" />
              </div>
            </ActionForm>
            <p className="mt-3 text-xs text-fg-3">{updated("pricing")}</p>
          </Card>
        </section>

        <section id="search">
          <SectionTitle>Operator search</SectionTitle>
          <Card>
            <ActionForm action={saveSetting} submitLabel="Save search">
              <input type="hidden" name="key" value="search" />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField name="radius_miles" label="Search radius" value={s.search.radius_miles} suffix="miles" hint="Around both origin and destination. New trips copy this value." />
                <NumberField name="max_operators" label="Operators per search" value={s.search.max_operators} step="1" />
                <NumberField name="quote_deadline_hours" label="Quote deadline" value={s.search.quote_deadline_hours} suffix="hours" />
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="include_prospects" defaultChecked={s.search.include_prospects} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
                <span><span className="font-medium">Include FAA prospects</span><span className="block text-fg-3">Search unvetted Part 135 operators after the approved network. Turn off once the network covers your routes.</span></span>
              </label>
            </ActionForm>
            <p className="mt-3 text-xs text-fg-3">{updated("search")} · Preferred and excluded operators are set per operator under <Link href="/desk/operators" className="text-accent-text hover:underline">Operators</Link>.</p>
          </Card>
        </section>

        <section id="automation">
          <SectionTitle>Automation</SectionTitle>
          <Card>
            <ActionForm action={saveSetting} submitLabel="Save automation">
              <input type="hidden" name="key" value="automation" />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField name="reminder_hours" label="Departure reminder" value={s.automation.reminder_hours} suffix="hours" hint="Countdown, cancellation reminder and itinerary link." />
                <NumberField name="active_hours_before" label="Trip turns active" value={s.automation.active_hours_before} suffix="h before" />
                <NumberField name="option_expiry_hours" label="Options expire after" value={s.automation.option_expiry_hours} suffix="hours" />
                <NumberField name="feedback_close_days" label="Close trip after feedback request" value={s.automation.feedback_close_days} suffix="days" />
              </div>
            </ActionForm>
            <p className="mt-3 text-xs text-fg-3">{updated("automation")}</p>
          </Card>
        </section>

        <section id="company">
          <SectionTitle>Company</SectionTitle>
          <Card>
            <ActionForm action={saveSetting} submitLabel="Save company">
              <input type="hidden" name="key" value="company" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Brand name" htmlFor="s-name"><Input id="s-name" name="name" defaultValue={s.company.name} required /></Field>
                <Field label="Legal name" htmlFor="s-legal" hint="Appears on contracts."><Input id="s-legal" name="legal_name" defaultValue={s.company.legal_name} required /></Field>
                <Field label="Support email" htmlFor="s-email"><Input id="s-email" name="support_email" type="email" defaultValue={s.company.support_email} required /></Field>
                <Field label="Support phone" htmlFor="s-phone"><Input id="s-phone" name="support_phone" type="tel" defaultValue={s.company.support_phone} /></Field>
                <Field label="Address" htmlFor="s-address" className="sm:col-span-2"><Textarea id="s-address" name="address" rows={2} defaultValue={s.company.address} /></Field>
              </div>
            </ActionForm>
            <p className="mt-3 text-xs text-fg-3">{updated("company")}</p>
          </Card>
        </section>

        <section id="payments">
          <SectionTitle>Payment instructions</SectionTitle>
          <Card>
            <p className="mb-4 text-sm text-fg-2">Shown to the client after they sign, for the method they choose. Replace the placeholders with the company&apos;s bank details.</p>
            <ActionForm action={saveSetting} submitLabel="Save instructions">
              <input type="hidden" name="key" value="payment_instructions" />
              <Field label="Wire transfer" htmlFor="s-wire"><Textarea id="s-wire" name="wire" rows={4} defaultValue={s.payment_instructions.wire} /></Field>
              <Field label="ACH" htmlFor="s-ach"><Textarea id="s-ach" name="ach" rows={3} defaultValue={s.payment_instructions.ach} /></Field>
              <Field label="Direct deposit" htmlFor="s-dd"><Textarea id="s-dd" name="direct_deposit" rows={3} defaultValue={s.payment_instructions.direct_deposit} /></Field>
              <Field label="Credit card" htmlFor="s-cc" hint="Card details are never collected in the app."><Textarea id="s-cc" name="credit_card" rows={2} defaultValue={s.payment_instructions.credit_card} /></Field>
              <Field label="Payment terms" htmlFor="s-terms" hint="Merged into contracts as {{payment_terms}}."><Textarea id="s-terms" name="terms" rows={2} defaultValue={s.payment_instructions.terms} /></Field>
            </ActionForm>
            <p className="mt-3 text-xs text-fg-3">{updated("payment_instructions")}</p>
          </Card>
        </section>

        <section id="cancellation">
          <SectionTitle>Cancellation policy</SectionTitle>
          <Card>
            <p className="mb-4 text-sm text-fg-2">Shown in the app, in the departure reminder, and merged into contracts as {"{{cancellation_policy}}"}.</p>
            <ActionForm action={saveSetting} submitLabel="Save policy">
              <input type="hidden" name="key" value="cancellation_policy" />
              <Field label="Title" htmlFor="s-ctitle"><Input id="s-ctitle" name="title" defaultValue={s.cancellation_policy.title} required /></Field>
              <Field label="Policy" htmlFor="s-cbody"><Textarea id="s-cbody" name="body" rows={8} defaultValue={s.cancellation_policy.body} required /></Field>
            </ActionForm>
            <p className="mt-3 text-xs text-fg-3">{updated("cancellation_policy")}</p>
          </Card>
        </section>
      </div>

      <section id="templates" className="mt-10">
        <SectionTitle action={!templates.some((t) => t.status === "draft") && <ActionForm action={newTemplateVersion} submitLabel="New version" variant="secondary" inline />}>
          Contract templates
        </SectionTitle>
        <p className="mb-4 max-w-3xl text-sm text-fg-2">
          Contracts are generated from the active version. Published versions are frozen: a contract already sent always keeps the exact wording the client saw. To change wording, create a new version, edit the draft, and publish it.
        </p>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/desk/settings?template=${t.id}#templates`}
                  aria-current={selected?.id === t.id ? "true" : undefined}
                  className={cx("block rounded-xl border px-4 py-3 text-sm", selected?.id === t.id ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-raised")}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.name} v{t.version}</span>
                    <Pill tone={t.status === "active" ? "ok" : t.status === "draft" ? "warn" : "neutral"}>{t.status}</Pill>
                  </span>
                  <span className="mt-1 block text-xs text-fg-3">Effective {shortDate(t.effective_date)} · used in {t.used} contract{t.used === 1 ? "" : "s"}</span>
                </Link>
              </li>
            ))}
          </ul>

          {selected && (
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-lg font-semibold">{selected.name} v{selected.version}</p>
                <p className="text-xs text-fg-3">Created {shortDate(selected.created_at)}{selected.author ? ` by ${selected.author}` : ""}</p>
              </div>
              {selected.notes && <p className="mb-4 rounded-xl bg-sunken px-3 py-2 text-sm text-fg-2">{selected.notes}</p>}
              {selected.status === "draft" ? (
                <>
                  <ActionForm action={saveTemplateDraft} submitLabel="Save draft">
                    <input type="hidden" name="templateId" value={selected.id} />
                    <Field label="Template body (markdown)" htmlFor="tpl-body">
                      <Textarea id="tpl-body" name="body" rows={28} defaultValue={selected.body} className="font-mono text-xs leading-relaxed" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Effective date" htmlFor="tpl-eff"><Input id="tpl-eff" name="effective_date" type="date" defaultValue={new Date(selected.effective_date).toISOString().slice(0, 10)} /></Field>
                      <Field label="Version notes" htmlFor="tpl-notes"><Input id="tpl-notes" name="notes" defaultValue={selected.notes ?? ""} placeholder="What changed" /></Field>
                    </div>
                  </ActionForm>
                  <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">
                    <ActionForm action={publishTemplate} submitLabel="Publish this version" inline confirm="Publish? New contracts will use this version and it can no longer be edited.">
                      <input type="hidden" name="templateId" value={selected.id} />
                    </ActionForm>
                    <ActionForm action={discardTemplateDraft} submitLabel="Discard draft" variant="ghost" inline confirm="Discard this draft?">
                      <input type="hidden" name="templateId" value={selected.id} />
                    </ActionForm>
                  </div>
                </>
              ) : (
                <div className="doc max-h-[640px] overflow-auto rounded-xl border border-line bg-raised p-6" dangerouslySetInnerHTML={{ __html: markdownToHtml(selected.body) }} />
              )}
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium text-fg-2">Available placeholders</summary>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {PLACEHOLDERS.map((p) => <code key={p} className="rounded bg-sunken px-1.5 py-0.5 text-xs">{`{{${p}}}`}</code>)}
                </p>
              </details>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
