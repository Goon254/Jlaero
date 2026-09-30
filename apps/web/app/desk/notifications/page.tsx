import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { ActionForm } from "@/components/lux/ActionForm";
import { EmptyState, PageHeader, Pill, cx } from "@/components/lux/ui";
import { shortDateTime } from "../_lib/table";
import { markAllRead, openNotification } from "./actions";

export const metadata = { title: "Notifications | Jlaero Desk" };

export default async function DeskNotifications() {
  const user = await requireStaff("view");
  const rows = await db()`select n.*, t.trip_number from notifications n left join trips t on t.id = n.trip_id
    where n.user_id = ${user.id} and n.channel = 'app'
    order by (n.read_at is null) desc, n.created_at desc limit 150`;
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard notifications"
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You are all caught up."}
        actions={unread > 0 && <ActionForm action={markAllRead} submitLabel="Mark all read" variant="secondary" inline />}
      />
      {rows.length === 0 ? <EmptyState title="No notifications yet" body="New requests, quotes, selections, payments and operational alerts show up here." /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((n) => {
            const urgent = String(n.title).startsWith("URGENT");
            return (
              <li key={n.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={n.id} />
                  <button type="submit" className={cx("flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-raised", !n.read_at && "bg-accent-soft/40")}>
                    <span aria-hidden className={cx("mt-2 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : urgent ? "bg-bad" : "bg-accent")} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cx("font-semibold", urgent && "text-bad")}>{n.title}</span>
                        {n.trip_number && <Pill>{n.trip_number}</Pill>}
                        {!n.read_at && <span className="sr-only">Unread</span>}
                      </span>
                      <span className="mt-1 block whitespace-pre-line text-sm text-fg-2">{n.message}</span>
                      <span className="mt-1 block text-xs text-fg-3">{shortDateTime(n.created_at)}</span>
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
