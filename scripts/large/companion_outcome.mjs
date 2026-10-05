/** Untimed material detail records never share a timing sample's fields. */
import { classificationEvidence } from "./timings.mjs";

const fields = [
  "materialBytes",
  "materialNormalizationBytes",
  "sourceNormalizationBytes",
  "materialHashBytes",
  "inlineFingerprintBytes",
  "inlineFingerprintHashes",
  "fingerprintedViews",
  "fingerprintSeams",
  "fingerprintSeamUnits",
];
const identityFields = [
  "templateDigest",
  "moklyCommit",
  "moklyDirty",
  "fixtureCommit",
  "renderingDependencies",
  "preparedMoklyCommit",
  "preparedMoklyDirty",
];

export function companionOutcome(records, sample) {
  const result = {
    kind: "material-work-companion",
    timed: false,
    scenario: sample.scenario,
    ...Object.fromEntries(
      identityFields
        .filter((key) => sample[key] !== undefined)
        .map((key) => [key, sample[key]]),
    ),
    expectedChangedIds: [...new Set(sample.expectedChangedIds)].sort(),
    expectedChangedRoutes: [...new Set(sample.expectedChangedRoutes)].sort(),
    ...(sample.changedIds
      ? { changedIds: [...new Set(sample.changedIds)].sort() }
      : {}),
    ...(sample.changedRoutes
      ? { changedRoutes: [...new Set(sample.changedRoutes)].sort() }
      : {}),
    outcome: "error",
    ...(sample.error
      ? { error: sample.error, failurePhase: sample.failurePhase }
      : {}),
  };
  try {
    const evidence = classificationEvidence(records, sample.stopRequestedMs);
    const start = records.find(
      ({ event }) =>
        event.role === "background" &&
        event.stage === "changes.classify" &&
        event.event === "start",
    )?.event;
    const end = records.find(
      ({ event }) =>
        event.role === "background" &&
        event.stage === "changes.classify" &&
        event.event === "end",
    )?.event;
    const details = records.filter(
      ({ event }) =>
        event.stage === "review.material-work" &&
        event.event === "counts" &&
        event.role === "background" &&
        event.session === start?.session &&
        event.elapsedMs >= start.elapsedMs &&
        (!end || event.elapsedMs <= end.elapsedMs),
    );
    if (details.length > 1)
      throw new Error("Ambiguous material companion counts");
    if (details[0]) {
      const counts = details[0].event.counts;
      if (
        !counts ||
        Object.keys(counts).sort().join() !== [...fields].sort().join() ||
        fields.some(
          (field) => !Number.isSafeInteger(counts[field]) || counts[field] < 0,
        ) ||
        counts.fingerprintSeamUnits > 24 * counts.fingerprintSeams
      )
        throw new Error("Invalid material companion counts");
      result.materialWork = counts;
    }
    if (evidence.comparisonCounts)
      result.comparisonCounts = evidence.comparisonCounts;
    if (evidence.inlineStyleCounts)
      result.inlineStyleCounts = evidence.inlineStyleCounts;
    if (evidence.documentWork)
      result.documentCounts = Object.fromEntries(
        Object.entries(evidence.documentWork).filter(
          ([name]) => !name.endsWith("Ms"),
        ),
      );
    if (evidence.classificationStatus === "incomplete")
      result.outcome = "incomplete";
    else if (evidence.classificationStatus === "error")
      result.outcome = "error";
    else if (evidence.classificationStatus !== "ok" || !result.materialWork)
      throw new Error("Completed material companion counts were not recorded");
    else if (result.changedIds === undefined || sample.error)
      result.outcome = "error";
    else if (
      JSON.stringify(result.changedIds) !==
        JSON.stringify(result.expectedChangedIds) ||
      JSON.stringify(result.changedRoutes) !==
        JSON.stringify(result.expectedChangedRoutes)
    )
      result.outcome = "membership-mismatch";
    else result.outcome = "ok";
  } catch (error) {
    result.outcome = "error";
    result.failurePhase = "measurement";
    result.error = [result.error, error.message].filter(Boolean).join("; ");
  }
  return result;
}
