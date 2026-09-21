/** Shared copy for screen and component workspace surfaces. */

/** Entry kinds whose comparison copy differs. */
export type EntryKind = "screen" | "component";

/** Product wording selected for one workspace entry kind. */
export interface EntryWording {
  label(copy: string): string;
  readonly noChanges: string;
}

const WORDING: Record<EntryKind, EntryWording> = {
  screen: {
    label: (copy) => copy,
    noChanges: "No changes to this screen.",
  },
  component: {
    label: (copy) =>
      copy.replace(/screen/g, "variant").replace(/Screen/g, "Variant"),
    noChanges: "No changes to this saved view.",
  },
};

/** Resolve the vocabulary used consistently across one workspace. */
export function entryWording(kind: EntryKind): EntryWording {
  return WORDING[kind];
}
