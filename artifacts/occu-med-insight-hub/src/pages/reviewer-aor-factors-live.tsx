import ReviewerAorFactorsV3 from "./reviewer-aor-factors-v3";

export { default as LegacyAorFactorsV2 } from "./reviewer-aor-factors-v2";

export default function ReviewerAorFactorsLive() {
  return <ReviewerAorFactorsV3 />;
}
