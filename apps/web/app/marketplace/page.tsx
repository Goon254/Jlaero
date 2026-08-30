import { PageShell, ComingSoon } from "@/components/PageShell";

export default function MarketplacePage() {
  return (
    <PageShell title="Aircraft for sale" subtitle="Browse jets for sale, or list your own.">
      <ComingSoon what="Aircraft sales listings" />
    </PageShell>
  );
}
