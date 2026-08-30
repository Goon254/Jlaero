import { PageShell, ComingSoon } from "@/components/PageShell";

export default function ListPage() {
  return (
    <PageShell
      title="List your aircraft"
      subtitle="Put your jet on Jlaero for charter or sale."
    >
      <ComingSoon what="Listing management" />
    </PageShell>
  );
}
