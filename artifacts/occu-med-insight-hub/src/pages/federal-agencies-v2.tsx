import LegacyFederalAgencies from "./federal-agencies-v2-legacy";
import "./federal-agencies-workbench.css";

export default function FederalAgenciesV2() {
  return (
    <div className="federal-agencies-workbench-v2" data-workbench="federal-agency-intelligence">
      <LegacyFederalAgencies />
    </div>
  );
}
