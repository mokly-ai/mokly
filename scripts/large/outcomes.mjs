/** Outcomes derive from recorded evidence, never from synthesized span ends. */
import { classificationEvidence } from "./timings.mjs";

export function sampleOutcome(records, sample) {
  const { stopRequestedMs, ...result } = sample;
  result.expectedChangedIds = [...new Set(sample.expectedChangedIds)].sort();
  result.expectedChangedRoutes = [
    ...new Set(sample.expectedChangedRoutes),
  ].sort();
  if (sample.changedIds !== undefined)
    result.changedIds = [...new Set(sample.changedIds)].sort();
  if (sample.changedRoutes !== undefined)
    result.changedRoutes = [...new Set(sample.changedRoutes)].sort();
  try {
    const evidence = classificationEvidence(records, stopRequestedMs);
    Object.assign(result, evidence);
    if (evidence.classificationStatus === undefined) {
      result.outcome = "error";
      result.failurePhase ??= "measurement";
      result.error ??= "Background classification was not recorded";
    } else if (evidence.classificationStatus === "incomplete")
      result.outcome = "incomplete";
    else if (evidence.classificationStatus === "error")
      result.outcome = "error";
    else if (
      sample.changedIds !== undefined &&
      JSON.stringify(result.changedIds) !==
        JSON.stringify(result.expectedChangedIds)
    )
      result.outcome = "membership-mismatch";
    else if (sample.error || sample.changedIds === undefined)
      result.outcome = "error";
    else result.outcome = "ok";
    if (result.outcome === "membership-mismatch") {
      result.expectedChangedCount = result.expectedChangedIds.length;
      result.changedCount = result.changedIds.length;
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
