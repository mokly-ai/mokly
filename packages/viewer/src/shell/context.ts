import type { ChangesStatus } from "../catalogue/types.js";
import type { ViewerTheme } from "../viewer/types.js";

/** Route-independent context shared by every view of one shell root. */
export interface ShellContext {
  /** Changes calculation state; omitted when Changes is disabled. */
  changesStatus?: Exclude<ChangesStatus, "disabled">;
  /** Id of the currently selected catalogue entry, when one is active. */
  activeId?: string;
  /** The index's Changes base ref; empty when the index names none. */
  base: string;
  /** Interface appearance the document starts from; omission means `auto`. */
  theme?: ViewerTheme;
  /**
   * True inside an embedding host, which supplies the appearance itself and
   * keeps the viewer's own preview controls. A standalone document instead
   * shows the one Appearance control.
   */
  embedded?: boolean;
  /**
   * Entries Changes lists: each one added, changed, or removed since the
   * base-ref branch point, and each one a move paired. Absent when unknown.
   */
  changedEntries?: readonly string[];
  /** The entries in `changedEntries` that changed beyond a move. */
  materialEntries?: readonly string[];
  /** Whether on-demand comparison serving is available. */
  comparisons?: boolean;
  /** Validated logical fragment applied to the routed target's frames. */
  fragment?: string;
  /** Exact removed record selected for this route. */
  snapshotId?: string;
}

/**
 * The entries that changed since the branch point beyond a move: Changes
 * membership without its pure moves.
 */
export function materialChangedEntries(
  context: ShellContext,
): readonly string[] | undefined {
  return context.materialEntries ?? context.changedEntries;
}
