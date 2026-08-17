import { OfficialSourcePortal } from "@/components/insight/OfficialSourcePortal";
import { OccupationalToolShell } from "@/components/insight/OccupationalToolPrimitives";

export default function OnetMasterTool() {
  return (
    <OccupationalToolShell
      eyebrow="Occupational intelligence"
      title="O*NET Master Tool"
      subtitle="Official O*NET OnLine inside Insight Hub"
      notice="Use O*NET directly inside the app. Browse occupations, job families, industries, Job Zones, tasks, work context, abilities, skills, knowledge, work activities, technologies, and the other information O*NET publishes without a separate custom database-browser layer."
    >
      <OfficialSourcePortal mode="onet" />
    </OccupationalToolShell>
  );
}
