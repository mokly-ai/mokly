import type { ResolutionPlan } from "../generated/sidecar/ResolutionPlan.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { EVIDENCE_LIMIT } from "./physical-input-reader.js";

/** Retain native targets only with the stable evidence of their bundle call. */
export function capturedPlan(
  plan: ResolutionPlan | undefined,
  evidence: ReuseEvidence,
): ResolutionPlan | undefined {
  if (!plan || !evidence.complete || !evidence.durable || evidence.uncaptured)
    return undefined;
  let bytes =
    Buffer.byteLength('[{"paths":[],"imports":[]},]') +
    Buffer.byteLength(JSON.stringify(evidence));
  let first = true;
  for (const file of plan.paths) {
    bytes += first ? 0 : 1;
    first = false;
    const pathBytes = stringBytes(file, EVIDENCE_LIMIT - bytes);
    if (pathBytes === undefined) return undefined;
    bytes += pathBytes;
  }
  first = true;
  for (const [importer, specifier, kind, target, sideEffects] of plan.imports) {
    bytes += first ? 0 : 1;
    first = false;
    const specifierBytes = stringBytes(specifier, EVIDENCE_LIMIT - bytes);
    if (specifierBytes === undefined) return undefined;
    bytes +=
      specifierBytes +
      Buffer.byteLength(
        JSON.stringify([importer, "", kind, target, sideEffects]),
      ) -
      2;
    if (bytes > EVIDENCE_LIMIT) return undefined;
  }
  return bytes <= EVIDENCE_LIMIT ? plan : undefined;
}

/** Count JSON string escaping without allocating an oversized encoded string. */
function stringBytes(value: string, limit: number): number | undefined {
  let bytes = 2;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (
      code === 34 ||
      code === 92 ||
      code === 8 ||
      code === 9 ||
      code === 10 ||
      code === 12 ||
      code === 13
    )
      bytes += 2;
    else if (code < 32) bytes += 6;
    else if (code < 128) bytes++;
    else if (code < 2048) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index++;
    } else bytes += code >= 0xd800 && code <= 0xdfff ? 6 : 3;
    if (bytes > limit) return undefined;
  }
  return bytes <= limit ? bytes : undefined;
}
