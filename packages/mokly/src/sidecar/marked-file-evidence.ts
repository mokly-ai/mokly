import path from "node:path";

import type { PhysicalInput } from "../generated/sidecar/PhysicalInput.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { EVIDENCE_LIMIT } from "./physical-input-reader.js";
import type { PhysicalInputs } from "./physical-inputs.js";

/** Select cache-only metadata files and their links without retaining discovery-only observations. */
export function markedFileEvidence(
  reader: PhysicalInputs,
  files: Iterable<string>,
): ReuseEvidence | undefined {
  const selected = new Map<string, PhysicalInput>();
  for (const file of files) {
    const value = reader.file(file);
    if (!reader.complete || !value) return undefined;
    if (value.kind === "file") {
      const canonical = reader.canonicalFile(file);
      if (!canonical) return undefined;
      selected.set(canonical, value);
    } else if (value.kind === "absent") selected.set(file, value);
    else return undefined;
    for (let current = file; ; current = path.dirname(current)) {
      const link = reader.inputs.get(current);
      if (link?.kind === "link") selected.set(current, link);
      if (current === path.dirname(current)) break;
    }
  }
  const evidence: ReuseEvidence = {
    complete: false,
    durable: false,
    uncaptured: "serveEdit",
    inputs: Object.fromEntries(
      [...selected].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  };
  if (
    Buffer.byteLength(JSON.stringify(evidence)) > EVIDENCE_LIMIT ||
    !reader.current({ complete: true, durable: false, inputs: evidence.inputs })
  )
    return undefined;
  return evidence;
}
