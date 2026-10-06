import type { ManifestEntry } from "@mokly/viewer/data";

/** Validated catalogue identity and metadata needed by the pure move policy. */
export interface MoveCandidate {
  kind: ManifestEntry["kind"];
  path: string;
  title: string;
  sourcePath: string;
  movedFrom?: string;
  variantOf?: string;
}

/** One unique pairing; paths retain their original spelling on each side. */
export interface EntryMove {
  kind: ManifestEntry["kind"];
  path: string;
  previousPath: string;
}

/** Generation-owned evidence shared by classification and capture. */
export interface MovePairing {
  moves: readonly EntryMove[];
  diagnostics: readonly string[];
}

/** Pure material signals supplied after the caller reads the validated documents. */
export interface MoveSignals {
  /** Production signals group content before equality; tests may supply only comparisons. */
  fingerprint?(
    entry: MoveCandidate,
    side: "before" | "after",
    accepted: readonly EntryMove[],
  ): { hash: string; ignores: string };
  identical(
    before: MoveCandidate,
    after: MoveCandidate,
    accepted: readonly EntryMove[],
  ): boolean;
  similarity(
    before: MoveCandidate,
    after: MoveCandidate,
    accepted: readonly EntryMove[],
  ): number;
}

/** Existing case-folded identities remain outside the move candidate set. */
export function moveIdentity(entry: MoveCandidate): string {
  return `${entry.kind}:${entry.path.toLowerCase()}`;
}

/** A component parent cannot adopt a component variant through a move signal. */
export function compatibleMove(a: MoveCandidate, b: MoveCandidate): boolean {
  return (
    a.kind === b.kind &&
    (a.kind !== "component" || Boolean(a.variantOf) === Boolean(b.variantOf))
  );
}

/** Carry a prior path only for a real move, never a case-only identity change. */
export function previousPathFields(
  before: { path: string } | undefined,
  after: { path: string } | undefined,
): { previousPath?: string } {
  return before &&
    after &&
    before.path.toLowerCase() !== after.path.toLowerCase()
    ? { previousPath: before.path }
    : {};
}
