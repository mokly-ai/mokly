import path from "node:path";

import type { ResolutionPlan } from "../generated/sidecar/ResolutionPlan.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

interface CandidateSource {
  names: ReadonlyMap<string, ReadonlySet<string>>;
  blocked: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  canonical(directory: string): string;
  retain(value: string, containerBytes: number): boolean;
  reserve(bytes: number): boolean;
}

/** Merge aliases into the captured canonical directory table under the capture budget. */
export function candidateDirectories(
  plan: ResolutionPlan,
  evidence: ReuseEvidence,
  source: CandidateSource,
): ResolutionPlan | undefined {
  for (const directory in evidence.inputs) {
    const input = evidence.inputs[directory]!;
    if (
      input.kind === "directory" &&
      input.entries.some((entry) =>
        entry.name.toLowerCase().startsWith(".pnp."),
      )
    )
      return plan;
  }
  const merged = new Map<string, Set<string>>();
  const blocked = new Set<string>();
  for (const [lexical, names] of source.names) {
    const canonical = source.canonical(lexical);
    let members = merged.get(canonical);
    if (!members) {
      if (!source.retain(canonical, 4)) return undefined;
      members = new Set();
      merged.set(canonical, members);
    }
    if (source.blocked.has(lexical) && !blocked.has(canonical)) {
      if (!source.retain(canonical, 1)) return undefined;
      blocked.add(canonical);
    }
    for (const name of names) {
      if (members.has(name)) continue;
      if (!source.retain(name, 1)) return undefined;
      members.add(name);
    }
  }
  for (const file of source.selected) {
    const directory = source.canonical(path.dirname(file));
    if (
      !merged.get(directory)?.has(path.basename(file).toLowerCase()) &&
      !blocked.has(directory)
    ) {
      if (!source.retain(directory, 1)) return undefined;
      blocked.add(directory);
    }
  }
  if (!source.reserve(plan.paths.length * 8 + 2)) return undefined;
  const paths = new Map<string, number>();
  plan.paths.forEach((file, index) => paths.set(file, index));
  const candidates: NonNullable<ResolutionPlan["candidates"]> = [];
  for (const directory in evidence.inputs) {
    const input = evidence.inputs[directory]!;
    if (input.kind !== "directory") continue;
    const names = merged.get(directory);
    if (!names || blocked.has(directory)) continue;
    const seen = new Set<string>();
    let unsafe = false;
    for (const { name } of input.entries) {
      if (Buffer.byteLength(name) !== name.length) {
        unsafe = true;
        break;
      }
      if (!source.retain(name, 1)) return undefined;
      const folded = name.toLowerCase();
      if (seen.has(folded)) {
        unsafe = true;
        break;
      }
      seen.add(folded);
    }
    if (unsafe) continue;
    if (!source.reserve(4 + names.size * 8)) return undefined;
    let index = paths.get(directory);
    if (index === undefined) {
      if (!source.retain(directory, 9)) return undefined;
      index = plan.paths.length;
      paths.set(directory, index);
      plan.paths.push(directory);
    }
    candidates.push([index, [...names].sort()]);
  }
  if (candidates.length) plan.candidates = candidates;
  return plan;
}
