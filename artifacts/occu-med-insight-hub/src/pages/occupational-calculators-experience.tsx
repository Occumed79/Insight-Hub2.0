import OccupationalCalculators from "./occupational-calculators-v3";
import "./occupational-calculators-experience.css";

export default function OccupationalCalculatorsExperience() {
  return (
    <div className="occupational-calculators-experience" data-workspace="occupational-calculators">
      <div className="occupational-instrument-field" aria-hidden="true">
        <span className="occupational-track occupational-track-a" />
        <span className="occupational-track occupational-track-b" />
        <span className="occupational-gauge" />
      </div>
      <OccupationalCalculators />
    </div>
  );
}
