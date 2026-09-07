import SecFilings from "./sec-filings";
import "./sec-filings-experience.css";

export default function SecFilingsExperience() {
  return (
    <div className="sec-filings-experience" data-workspace="sec-filings">
      <div className="sec-filings-market-field" aria-hidden="true">
        <span className="sec-filings-axis sec-filings-axis-a" />
        <span className="sec-filings-axis sec-filings-axis-b" />
        <span className="sec-filings-trace" />
      </div>
      <SecFilings />
    </div>
  );
}
