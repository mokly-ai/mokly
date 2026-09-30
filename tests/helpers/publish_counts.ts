import { createHash } from "node:crypto";

interface CountedPlan {
  files: ReadonlyMap<string, Buffer>;
  missing: readonly string[];
  ownership: {
    files: ReadonlyArray<{ sha256: string }>;
  };
}

/** Independently count marker entries sent through one successful Plan round. */
export function expectedUploadedEntries(plan: CountedPlan): number {
  const sent = new Set(plan.missing);
  for (const bytes of plan.files.values())
    sent.add(createHash("sha256").update(bytes).digest("hex"));
  return plan.ownership.files.filter(({ sha256 }) => sent.has(sha256)).length;
}
