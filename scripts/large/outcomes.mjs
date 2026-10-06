/** Outcomes derive from recorded evidence, never from synthesized span ends. */
import { classificationEvidence } from "./timings.mjs";

export function sampleOutcome(records, sample) {
  const { stopRequestedMs, ...result } = sample;
  const detailField = (name) =>
    /^(?:kind$|timed$|companion|material|sourceNormalization|inlineFingerprint|fingerprinted|fingerprintSeam)/.test(
      name,
    );
  const forbidden = Object.keys(result).filter(detailField);
  for (const name of forbidden) delete result[name];
  const detailedDocument = Object.keys(result.documentWork ?? {}).some(
    detailField,
  );
  if (detailedDocument) delete result.documentWork;
  result.expectedChangedPaths = [
    ...new Set(sample.expectedChangedPaths),
  ].sort();
  result.expectedChangedRoutes = [
    ...new Set(sample.expectedChangedRoutes),
  ].sort();
  if (sample.changedPaths !== undefined)
    result.changedPaths = [...new Set(sample.changedPaths)].sort();
  if (sample.changedRoutes !== undefined)
    result.changedRoutes = [...new Set(sample.changedRoutes)].sort();
  try {
    const evidence = classificationEvidence(records, stopRequestedMs);
    Object.assign(result, evidence);
    if (
      forbidden.length ||
      detailedDocument ||
      records.some(({ event }) => event.stage === "review.material-work") ||
      Object.keys(result.documentWork ?? {}).some(detailField)
    ) {
      delete result.documentWork;
      throw new Error(
        "Material detail collection is forbidden in timed samples",
      );
    }
    if (evidence.classificationStatus === undefined) {
      result.outcome = "error";
      result.failurePhase ??= "measurement";
      result.error ??= "Background classification was not recorded";
    } else if (evidence.classificationStatus === "incomplete")
      result.outcome = "incomplete";
    else if (evidence.classificationStatus === "error")
      result.outcome = "error";
    else if (
      sample.changedPaths !== undefined &&
      JSON.stringify(result.changedPaths) !==
        JSON.stringify(result.expectedChangedPaths)
    )
      result.outcome = "membership-mismatch";
    else if (sample.error || sample.changedPaths === undefined)
      result.outcome = "error";
    else result.outcome = "ok";
    if (result.outcome === "membership-mismatch") {
      result.expectedChangedCount = result.expectedChangedPaths.length;
      result.changedCount = result.changedPaths.length;
    }
  } catch (error) {
    result.outcome = "error";
    result.failurePhase = "measurement";
    result.error = [result.error, error.message].filter(Boolean).join("; ");
  }
  if (result.outcome === "error" && !result.error) {
    result.failurePhase =
      result.classificationStatus === "error" ? "classification" : "delivery";
    result.error =
      result.classificationStatus === "error"
        ? "Background classification failed"
        : "Complete Changes membership was not delivered";
  }
  return result;
}
