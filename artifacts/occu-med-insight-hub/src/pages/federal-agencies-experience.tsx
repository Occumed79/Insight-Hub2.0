import FederalAgencies from "./federal-agencies-v2";
import "./federal-agencies-experience.css";

export default function FederalAgenciesExperience() {
  return (
    <div className="federal-agencies-experience" data-workspace="federal-agencies">
      <div className="federal-agency-field" aria-hidden="true">
        <span className="agency-spine agency-spine-a" />
        <span className="agency-spine agency-spine-b" />
        <span className="agency-seal" />
      </div>
      <FederalAgencies />
    </div>
  );
}
