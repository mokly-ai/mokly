import { MoklyError } from "../errors.js";
import type { EntryMove } from "../review/moves/types.js";

/** Accepted comparison evidence for one immutable consumer rendering generation. */
export interface AcceptedMoveTargets {
  generation: string;
  moves: readonly EntryMove[];
}

export type MoveTargetsProvider = (
  generation: string,
) => AcceptedMoveTargets | undefined;

/** Reject stale evidence rather than attaching another generation's suggestions. */
export function moveTargetsForGeneration(
  targets: AcceptedMoveTargets | undefined,
  generation: string,
): readonly EntryMove[] {
  if (!targets) return [];
  if (targets.generation !== generation)
    throw new MoklyError(
      "build-invalid",
      "Move evidence belongs to another render generation",
    );
  return targets.moves;
}
