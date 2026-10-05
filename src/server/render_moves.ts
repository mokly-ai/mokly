import type { AcceptedMoveTargets } from "../build/move_targets.js";

import type { ComponentChangeSnapshot } from "./component_change_types.js";
import type { ChangesStatus } from "./update_messages.js";

/** Keep diagnostic suggestions tied to accepted evidence and an unchanged renderer. */
export class RenderMoveTargets {
  private accepted: AcceptedMoveTargets | undefined;

  readonly read = (generation: string): AcceptedMoveTargets | undefined =>
    this.accepted?.generation === generation ? this.accepted : undefined;

  accept(
    runtime: { capability(): { generation: string } } | undefined,
    snapshot: Pick<ComponentChangeSnapshot, "pairing"> | undefined,
    status: ChangesStatus,
  ): void {
    this.accepted =
      runtime && status === "ready" && snapshot?.pairing
        ? {
            generation: runtime.capability().generation,
            moves: snapshot.pairing.moves,
          }
        : undefined;
  }

  clear(): void {
    this.accepted = undefined;
  }
}
