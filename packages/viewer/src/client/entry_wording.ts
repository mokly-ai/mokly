/** One vocabulary for the entry the inspector describes, so a screen and a
 * component's saved view never drift apart in copy. */

/** The catalogue entry kinds the workspace words its copy for. */
export type EntryKind = "screen" | "component";

/** The copy one entry kind uses wherever the shell names what it compared. */
export interface EntryWording {
  /** Recast screen-worded copy, such as a comparison stage label. */
  label(copy: string): string;
  /** The line that closes the evidence of an entry with no changes. */
  readonly noChanges: string;
}

const SCREEN: EntryWording = {
  label: (copy) => copy,
  noChanges: "No changes to this screen.",
};

const COMPONENT: EntryWording = {
  label: (copy) =>
    copy.replace(/screen/g, "variant").replace(/Screen/g, "Variant"),
  noChanges: "No changes to this saved view.",
};

const WORDING: Record<EntryKind, EntryWording> = {
  screen: SCREEN,
  component: COMPONENT,
};

/** Resolve the wording an entry kind uses; the shell shares this one source. */
export function entryWording(kind: EntryKind): EntryWording {
  return WORDING[kind];
}
