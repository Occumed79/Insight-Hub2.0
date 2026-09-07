import ReviewerDrugChecker from "./reviewer-drug-checker";
import "./reviewer-drug-checker-experience.css";

export default function ReviewerDrugCheckerExperience() {
  return (
    <div className="drug-checker-experience" data-workspace="drug-checker">
      <div className="drug-spectrum-field" aria-hidden="true">
        <span className="drug-spectrum-line drug-spectrum-line-a" />
        <span className="drug-spectrum-line drug-spectrum-line-b" />
        <span className="drug-spectrum-ring drug-spectrum-ring-a" />
        <span className="drug-spectrum-ring drug-spectrum-ring-b" />
      </div>
      <ReviewerDrugChecker />
    </div>
  );
}
