import { Sidebar } from "@/components/insight/Sidebar";

export default function ReviewerAorFactorsV3Page() {
  return (
    <main className="min-h-screen bg-[#05080c] text-white">
      <Sidebar />
      <section
        data-testid="aor-factors-reset-canvas"
        aria-label="AOR Factors blank workspace"
        className="min-h-screen lg:ml-[210px]"
      />
    </main>
  );
}
