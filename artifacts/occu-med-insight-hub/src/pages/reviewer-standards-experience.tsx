import ReviewerStandardsIntelligence from "./reviewer-standards-intelligence";
import "./reviewer-standards-experience.css";

export default function ReviewerStandardsExperience() {
  return (
    <div className="standards-experience" data-workspace="standards-intelligence">
      <div className="standards-rule-field" aria-hidden="true">
        <span className="standards-rule-line standards-rule-line-a" />
        <span className="standards-rule-line standards-rule-line-b" />
        <span className="standards-rule-node standards-rule-node-a" />
        <span className="standards-rule-node standards-rule-node-b" />
      </div>
      <ReviewerStandardsIntelligence />
    </div>
  );
}
