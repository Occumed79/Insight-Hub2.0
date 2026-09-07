import JobIntelligence from "./job-intelligence-v2";
import "./job-intelligence-experience.css";

export default function JobIntelligenceExperience() {
  return (
    <div className="job-intelligence-experience" data-workspace="job-intelligence">
      <div className="job-intelligence-field" aria-hidden="true">
        <span className="job-path job-path-a" />
        <span className="job-path job-path-b" />
        <span className="job-node job-node-a" />
        <span className="job-node job-node-b" />
      </div>
      <JobIntelligence />
    </div>
  );
}
