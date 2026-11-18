import type { PlannedImport } from "../generated/sidecar/PlannedImport.js";
import type { ResolutionPlan } from "../generated/sidecar/ResolutionPlan.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { EVIDENCE_LIMIT } from "./physical-input-reader.js";

/** Retain native targets only with the stable evidence of their bundle call. */
export function capturedPlan(
  imports: ReadonlyMap<string, PlannedImport> | undefined,
  evidence: ReuseEvidence,
): ResolutionPlan | undefined {
  if (
    !imports ||
    !evidence.complete ||
    !evidence.durable ||
    evidence.uncaptured
  )
    return undefined;
  let bytes =
    Buffer.byteLength('[{"imports":{}},]') +
    Buffer.byteLength(JSON.stringify(evidence));
  let first = true;
  for (const [key, target] of imports) {
    bytes += first ? 0 : 1;
    first = false;
    const keyBytes = stringBytes(key, EVIDENCE_LIMIT - bytes);
    if (keyBytes === undefined) return undefined;
    bytes += keyBytes + 1;
    const pathBytes = stringBytes(target.path, EVIDENCE_LIMIT - bytes);
    if (pathBytes === undefined) return undefined;
    bytes +=
      pathBytes +
      Buffer.byteLength(
        JSON.stringify({
          path: "",
          sideEffects: target.sideEffects,
        }),
      ) -
      2;
    if (bytes > EVIDENCE_LIMIT) return undefined;
  }
  return bytes <= EVIDENCE_LIMIT
    ? { imports: Object.fromEntries(imports) }
    : undefined;
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
