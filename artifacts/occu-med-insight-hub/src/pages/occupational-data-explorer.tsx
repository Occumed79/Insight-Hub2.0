import { OfficialSourcePortal } from "@/components/insight/OfficialSourcePortal";
import { OccupationalToolShell } from "@/components/insight/OccupationalToolPrimitives";

export default function OccupationalDataExplorer() {
  return (
    <OccupationalToolShell
      eyebrow="Occupational intelligence"
      title="Occupational Data Explorer"
      subtitle="BLS · OSHA · Data.gov"
      notice="Use the official source pages directly inside Insight Hub. Switch sources at the top of the embedded workspace; no NAICS code, series ID, dataset name, or custom raw-table browser is required to begin."
    >
      <OfficialSourcePortal mode="occupational" />
    </OccupationalToolShell>
  );
}
