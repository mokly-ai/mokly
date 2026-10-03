import { compatibleMove, type MoveCandidate } from "./types.js";

interface MoveEdge {
  before: MoveCandidate;
  after: MoveCandidate;
  score: number;
}

/** Evaluate one immutable pass and retain only unique, mutual matches. */
export function matchMovePass(
  before: readonly MoveCandidate[],
  after: readonly MoveCandidate[],
  score: (before: MoveCandidate, after: MoveCandidate) => number,
  bestOnly = false,
  candidates?: (head: MoveCandidate) => readonly MoveCandidate[],
): {
  pairs: readonly { before: MoveCandidate; after: MoveCandidate }[];
  ambiguous: readonly { entry: MoveCandidate; diagnostic: string }[];
} {
  const edges: MoveEdge[] = [];
  for (const head of after)
    for (const base of candidates?.(head) ?? before) {
      if (!compatibleMove(base, head)) continue;
      const value = score(base, head);
      if (value >= 0.5) edges.push({ before: base, after: head, score: value });
    }
  const beforeEdges = new Map<MoveCandidate, MoveEdge[]>();
  const afterEdges = new Map<MoveCandidate, MoveEdge[]>();
  for (const edge of edges) {
    const bases = beforeEdges.get(edge.before) ?? [];
    const heads = afterEdges.get(edge.after) ?? [];
    bases.push(edge);
    heads.push(edge);
    beforeEdges.set(edge.before, bases);
    afterEdges.set(edge.after, heads);
  }
  const matches = (entry: MoveCandidate, side: "before" | "after") => {
    const found =
      (side === "before" ? beforeEdges : afterEdges).get(entry) ?? [];
    if (!bestOnly || !found.length) return found;
    const best = Math.max(...found.map((edge) => edge.score));
    return found.filter((edge) => edge.score === best);
  };
  const bases = new Map(
    before.map((entry) => [entry, matches(entry, "before")]),
  );
  const heads = new Map(after.map((entry) => [entry, matches(entry, "after")]));
  const ambiguous: { entry: MoveCandidate; diagnostic: string }[] = [];
  for (const [side, entries] of [
    ["after", after],
    ["before", before],
  ] as const)
    for (const entry of entries) {
      const found = (side === "after" ? heads : bases).get(entry)!;
      if (found.length < 2) continue;
      const opposite = side === "after" ? "before" : "after";
      const paths = found.map((edge) => edge[opposite].path).sort();
      ambiguous.push({
        entry,
        diagnostic: `${side === "after" ? "added" : "removed"} ${entry.kind} ${entry.path} matches ${side === "after" ? "removed" : "added"} entries ${paths.join(" and ")}; declare movedFrom to pair it`,
      });
    }
  const pairs = after.flatMap((head) => {
    const found = heads.get(head)!;
    if (found.length !== 1) return [];
    const edge = found[0]!;
    const reverse = bases.get(edge.before)!;
    return reverse.length === 1 && reverse[0]!.after === head
      ? [{ before: edge.before, after: head }]
      : [];
  });
  return { pairs, ambiguous };
}
