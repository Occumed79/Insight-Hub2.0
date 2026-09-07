import ReviewerAorFactors from "./reviewer-aor-factors-live";
import "./reviewer-aor-factors-experience.css";

export default function ReviewerAorFactorsExperience() {
  return (
    <div className="aor-factors-experience" data-workspace="aor-factors">
      <div className="aor-atmosphere" aria-hidden="true">
        <span className="aor-latitude aor-latitude-one" />
        <span className="aor-latitude aor-latitude-two" />
        <span className="aor-pulse aor-pulse-one" />
        <span className="aor-pulse aor-pulse-two" />
      </div>
      <ReviewerAorFactors />
    </div>
  );
}
