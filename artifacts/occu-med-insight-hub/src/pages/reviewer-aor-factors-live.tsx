import ReviewerAorFactorsCesium from "./reviewer-aor-factors-cesium";

// Legacy MapTiler builds (v2/v3) stay importable for reference only; the live AOR
// Factors page is the CesiumJS workspace.
export { default as LegacyAorFactorsV2 } from "./reviewer-aor-factors-v2";
export { default as LegacyAorFactorsV3 } from "./reviewer-aor-factors-v3";

export default function ReviewerAorFactorsLive() {
  return <ReviewerAorFactorsCesium />;
}
