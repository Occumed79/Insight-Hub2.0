import FederalAwards from "./federal-awards-v2";
import "./federal-awards-experience.css";

export default function FederalAwardsExperience() {
  return (
    <div className="federal-awards-experience" data-workspace="federal-awards">
      <div className="federal-awards-timefield" aria-hidden="true">
        <span className="federal-awards-band federal-awards-band-a" />
        <span className="federal-awards-band federal-awards-band-b" />
        <span className="federal-awards-band federal-awards-band-c" />
      </div>
      <FederalAwards />
    </div>
  );
}
