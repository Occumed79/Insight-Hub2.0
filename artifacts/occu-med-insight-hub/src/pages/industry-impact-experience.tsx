import IndustryImpactCalculator from "./industry-impact-calculator-v3";
import "./industry-impact-experience.css";

export default function IndustryImpactExperience() {
  return (
    <div className="industry-impact-experience" data-workspace="industry-impact">
      <div className="industry-impact-field" aria-hidden="true">
        <span className="impact-horizon impact-horizon-one" />
        <span className="impact-horizon impact-horizon-two" />
        <span className="impact-surface" />
      </div>
      <IndustryImpactCalculator />
    </div>
  );
}
