import ReviewerClinicalCalculators from "./reviewer-clinical-calculators";
import "./reviewer-clinical-calculators-experience.css";

export default function ReviewerClinicalCalculatorsExperience() {
  return (
    <div className="clinical-calculators-experience" data-workspace="clinical-calculators">
      <div className="clinical-instrument-field" aria-hidden="true">
        <span className="clinical-scale clinical-scale-a" />
        <span className="clinical-scale clinical-scale-b" />
        <span className="clinical-reticle" />
      </div>
      <ReviewerClinicalCalculators />
    </div>
  );
}
