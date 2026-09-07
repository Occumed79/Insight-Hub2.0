import StateAgencies from "./state-agencies-v2";
import "./state-agencies-experience.css";

export default function StateAgenciesExperience() {
  return (
    <div className="state-agencies-experience" data-workspace="state-agencies">
      <div className="state-jurisdiction-field" aria-hidden="true">
        <span className="state-grid-line state-grid-line-a" />
        <span className="state-grid-line state-grid-line-b" />
        <span className="state-focus-ring" />
      </div>
      <StateAgencies />
    </div>
  );
}
