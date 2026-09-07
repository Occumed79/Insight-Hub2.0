import WarCostsMap from "./war-costs-map";
import "./war-costs-map-experience.css";

export default function WarCostsMapExperience() {
  return (
    <div className="war-costs-map-experience" data-workspace="defense-footprint-map">
      <div className="war-map-radar-field" aria-hidden="true">
        <span className="war-map-radar-ring war-map-radar-ring-a" />
        <span className="war-map-radar-ring war-map-radar-ring-b" />
        <span className="war-map-bearing war-map-bearing-a" />
        <span className="war-map-bearing war-map-bearing-b" />
      </div>
      <WarCostsMap />
    </div>
  );
}
