import { matchMovePass } from "./pass.js";
import {
  compatibleMove,
  moveIdentity,
  type EntryMove,
  type MoveCandidate,
  type MovePairing,
  type MoveSignals,
} from "./types.js";

/** Pair removed and added entries once, in the contract's ordered signal passes. */
export function pairMoves(
  before: readonly MoveCandidate[],
  after: readonly MoveCandidate[],
  signals: MoveSignals,
): MovePairing {
  const baseByIdentity = new Map(
    before.map((entry) => [moveIdentity(entry), entry]),
  );
  const current = new Set(after.map(moveIdentity));
  const bases = before
    .filter((entry) => !current.has(moveIdentity(entry)))
    .sort(byPath);
  const heads = after
    .filter((entry) => !baseByIdentity.has(moveIdentity(entry)))
    .sort(byPath);
  const unavailable = new Set<MoveCandidate>();
  const moves: EntryMove[] = [];
  const diagnostics: string[] = [];
  const parentPairs = new Map<string, MoveCandidate>();
  for (const entry of after) {
    const base = baseByIdentity.get(moveIdentity(entry));
    if (base) parentPairs.set(moveIdentity(entry), base);
  }
  const accept = (base: MoveCandidate, head: MoveCandidate) => {
    unavailable.add(base);
    unavailable.add(head);
    parentPairs.set(moveIdentity(head), base);
    moves.push({ kind: head.kind, path: head.path, previousPath: base.path });
  };
  const variants = () => {
    for (const head of heads) {
      if (unavailable.has(head) || !head.variantOf) continue;
      const parent = parentPairs.get(
        `${head.kind}:${head.variantOf.toLowerCase()}`,
      );
      if (!parent) continue;
      const base = bases.find(
        (candidate) =>
          !unavailable.has(candidate) &&
          compatibleMove(candidate, head) &&
          candidate.variantOf?.toLowerCase() === parent.path.toLowerCase() &&
          leaf(candidate.path) === leaf(head.path),
      );
      if (base) accept(base, head);
    }
  };
  for (const head of heads) {
    if (head.movedFrom === undefined) continue;
    if (
      bases.some(
        (base) =>
          compatibleMove(base, head) &&
          base.path.toLowerCase() === head.movedFrom!.toLowerCase(),
      )
    )
      continue;
    unavailable.add(head);
    diagnostics.push(
      `${head.path}: movedFrom ${head.movedFrom} matched no removed baseline entry of kind ${head.kind}`,
    );
  }
  const passes = [
    (base: MoveCandidate, head: MoveCandidate) =>
      base.path.toLowerCase() === head.movedFrom?.toLowerCase() ? 1 : 0,
    (base: MoveCandidate, head: MoveCandidate) =>
      signals.identical(base, head, moves) ? 1 : 0,
    (base: MoveCandidate, head: MoveCandidate) =>
      head.kind !== "document" &&
      base.sourcePath === head.sourcePath &&
      base.title === head.title
        ? 1
        : 0,
    (base: MoveCandidate, head: MoveCandidate) =>
      head.kind === "page" || head.kind === "document"
        ? signals.similarity(base, head, moves)
        : 0,
  ];
  for (const [index, score] of passes.entries()) {
    const result = matchMovePass(
      bases.filter((entry) => !unavailable.has(entry)),
      heads.filter((entry) => !unavailable.has(entry)),
      score,
      index === 3,
    );
    for (const pair of result.pairs)
      if (index === 0 || !pair.after.variantOf) accept(pair.before, pair.after);
    variants();
    for (const pair of result.pairs)
      if (!unavailable.has(pair.before) && !unavailable.has(pair.after))
        accept(pair.before, pair.after);
    for (const { entry, diagnostic } of result.ambiguous) {
      if (unavailable.has(entry)) continue;
      unavailable.add(entry);
      diagnostics.push(diagnostic);
    }
  }
  return { moves: moves.sort(byPath), diagnostics };
}

function leaf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).toLowerCase();
}

function byPath(a: { path: string }, b: { path: string }): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}
