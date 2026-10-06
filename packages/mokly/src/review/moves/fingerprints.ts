import type { EntryMove, MoveCandidate, MoveSignals } from "./types.js";

/** Index equal signatures; only unlike ignore contracts need pairwise fallback. */
export function fingerprintCandidates(
  before: readonly MoveCandidate[],
  after: readonly MoveCandidate[],
  signals: MoveSignals,
  moves: readonly EntryMove[],
): ((head: MoveCandidate) => readonly MoveCandidate[]) | undefined {
  if (!signals.fingerprint || !before.length || !after.length) return;
  const headRoles = new Set(after.map(role));
  const roles = new Map<string, Map<string, Map<string, MoveCandidate[]>>>();
  for (const entry of before) {
    if (!headRoles.has(role(entry))) continue;
    const signature = signals.fingerprint(entry, "before", moves);
    const key = role(entry);
    const contracts =
      roles.get(key) ?? new Map<string, Map<string, MoveCandidate[]>>();
    const hashes =
      contracts.get(signature.ignores) ?? new Map<string, MoveCandidate[]>();
    const entries = hashes.get(signature.hash) ?? [];
    entries.push(entry);
    hashes.set(signature.hash, entries);
    contracts.set(signature.ignores, hashes);
    roles.set(key, contracts);
  }
  const candidates = new Map<MoveCandidate, readonly MoveCandidate[]>();
  for (const entry of after) {
    if (!roles.has(role(entry))) {
      candidates.set(entry, []);
      continue;
    }
    const signature = signals.fingerprint(entry, "after", moves);
    const contracts = roles.get(role(entry));
    const matches = [
      ...(contracts?.get(signature.ignores)?.get(signature.hash) ?? []),
    ];
    for (const [contract, hashes] of contracts ?? [])
      if (contract !== signature.ignores)
        for (const entries of hashes.values()) matches.push(...entries);
    candidates.set(entry, matches);
  }
  return (entry) => candidates.get(entry) ?? [];
}

function role(entry: MoveCandidate): string {
  return `${entry.kind}:${entry.kind === "component" && Boolean(entry.variantOf)}`;
}
