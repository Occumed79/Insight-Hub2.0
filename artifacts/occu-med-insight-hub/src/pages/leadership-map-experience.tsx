import LeadershipMap from "./leadership-map";
import "./leadership-map-experience.css";

export default function LeadershipMapExperience() {
  return (
    <div className="leadership-map-experience" data-workspace="organizational-chart">
      <div className="leadership-topology-field" aria-hidden="true">
        <span className="leadership-orbit leadership-orbit-one" />
        <span className="leadership-orbit leadership-orbit-two" />
        <span className="leadership-node leadership-node-one" />
        <span className="leadership-node leadership-node-two" />
        <span className="leadership-node leadership-node-three" />
      </div>
      <LeadershipMap />
    </div>
  );
}
