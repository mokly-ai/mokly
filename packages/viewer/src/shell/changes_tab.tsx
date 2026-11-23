/**
 * The body of the right panel's Changes tab for any entry, under the
 * [Changes tab](../../../../docs/protocol/mokly-changes-controls.md#changes-tab):
 * the change stepper of the entry's place among the entries that the Changes
 * filter lists, the host's `changesStart` content, the Compared rail, and the
 * compare modes and the comparison details that the caller gives. This
 * container reads the store and the slot; `@mokly/ui/changes-panel` lays out
 * the parts in their order.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";

import { ChangeStepper } from "@mokly/ui/change-stepper";
import { ChangesPanel } from "@mokly/ui/changes-panel";
import { ComparedRail, type ComparedOutcome } from "@mokly/ui/compared-rail";

import { changePosition } from "./change_position.js";
import { useChangesStart } from "./changes_start.js";
import { useShellRoot } from "./root_context.js";
import { useShellStore } from "./store_context.js";
import type { EntryStatus } from "./view_status.js";

/**
 * The one version that the Compared rail holds: an added entry's current
 * version, or a removed entry's version before. Any other status holds both.
 */
export function comparedOutcome(
  status: EntryStatus | undefined,
): ComparedOutcome | undefined {
  if (status === "Added") return "added";
  return status === "Removed" ? "removed" : undefined;
}

/**
 * The routed entry's Changes tab. The stepper's steps open the entries before
 * and after it at their catalogue rows' addresses, which name no viewport and
 * no scheme, so the shell's sticky selection stays; the store keeps the
 * selected tab, so they open on Changes. An entry that the Changes filter does
 * not list has no stepper. The host's slot registers its container, so the
 * shell leaves the host's content alone.
 */
export function ChangesTab({
  details,
  modes,
  path,
  status,
}: {
  /** The comparison details, without the branch-point sentence that the rail replaces. */
  details: ReactNode;
  /** The compare modes; absent for an entry that offers none. */
  modes?: ReactNode;
  /** The routed entry's path; the route's snapshot names a removed record. */
  path: string;
  /** The status that the entry shows, which decides the rail's versions. */
  status: EntryStatus | undefined;
}) {
  const { context, sections } = useShellStore();
  const slot = useChangesStart();
  const slotRef = useShellRoot()?.elements.slots.ref("changesStart");
  // The list walks every row of the catalogue, so it waits for a change of
  // the sections or the context, which the store keeps between renders.
  const position = useMemo(
    () =>
      changePosition(sections, context, {
        path,
        snapshotId: context.snapshotId,
      }),
    [context, path, sections],
  );
  return (
    <ChangesPanel
      compared={
        <ComparedRail base={context.base} outcome={comparedOutcome(status)} />
      }
      details={details}
      modes={modes}
      slot={slot}
      slotRef={slotRef}
      stepper={
        position ? (
          <ChangeStepper
            nextHref={position.next?.href}
            position={position.position}
            previousHref={position.previous?.href}
            total={position.total}
          />
        ) : undefined
      }
    />
  );
}
