import { PageShell } from "@/components/PageShell";
import { getCurrentUser } from "@/lib/auth";
import { RequestForm } from "./RequestForm";

export default async function RequestTripPage() {
  const user = await getCurrentUser();
  return (
    <PageShell
      title="Request a private jet"
      subtitle="Tell us the trip. We source the aircraft from certificated operators and come back with up to three all-in options."
    >
      <RequestForm signedIn={!!user} userId={user?.id ?? null} />
      <section className="mt-12 grid gap-6 text-sm text-slate-400 md:grid-cols-3">
        <div><p className="font-medium text-slate-200">1. You request</p><p className="mt-1">Route, dates, passengers, and the cabin you have in mind. Two minutes.</p></div>
        <div><p className="font-medium text-slate-200">2. We source</p><p className="mt-1">Our desk asks the right operators near your departure and checks safety ratings and availability.</p></div>
        <div><p className="font-medium text-slate-200">3. You choose</p><p className="mt-1">Value, Preferred, or Premium: one final price each, taxes included. Accept, sign, pay, fly.</p></div>
      </section>
      <p className="mt-10 text-xs text-slate-500">
        Jlaero is an air charter broker, not a direct air carrier. Flights are operated by FAA Part 135 certificated carriers, named to you before you pay.
      </p>
    </PageShell>
  );
}
