import { PageShell, ComingSoon } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";

export default async function BookingsPage() {
  await requireUser();
  return (
    <PageShell title="My bookings" subtitle="Your charter and crew requests.">
      <ComingSoon what="Bookings" />
    </PageShell>
  );
}
