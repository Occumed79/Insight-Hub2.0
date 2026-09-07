import LegalInjuryIntelligence from "./legal-injury-intelligence-v2";
import "./legal-injury-experience.css";

export default function LegalInjuryExperience() {
  return (
    <div className="legal-injury-experience" data-workspace="legal-injury">
      <div className="legal-case-field" aria-hidden="true">
        <span className="legal-case-rule legal-case-rule-a" />
        <span className="legal-case-rule legal-case-rule-b" />
        <span className="legal-case-stamp" />
      </div>
      <LegalInjuryIntelligence />
    </div>
  );
}
