/** Shared copy for screen and component workspace surfaces. */

/** Entry kinds whose comparison copy differs. */
export type EntryKind = "screen" | "component";

/** Product wording selected for one workspace entry kind. */
export interface EntryWording {
  readonly excludedStylesheet: string;
  readonly excludedStylesheets: string;
  readonly filesLead: string;
  label(copy: string): string;
  readonly matchedStylesWithSelectors: string;
  readonly matchedStylesWithoutSelectors: string;
  readonly noChanges: string;
  readonly unresolvedStylesWithSelectors: string;
  readonly unresolvedStylesWithoutSelectors: string;
}

const WORDING: Record<EntryKind, EntryWording> = {
  screen: {
    excludedStylesheet:
      "This stylesheet changed, but none of the changed styles apply to this screen.",
    excludedStylesheets:
      "These stylesheets changed, but none of the changed styles apply to this screen.",
    filesLead: "Changes to these files may affect this screen:",
    label: (copy) => copy,
    matchedStylesWithSelectors: "Changed styles that apply to this screen:",
    matchedStylesWithoutSelectors: "Changed styles that apply to this screen.",
    noChanges: "No changes to this screen.",
    unresolvedStylesWithSelectors:
      "This change can apply anywhere on the screen, so the screen stays in Changes:",
    unresolvedStylesWithoutSelectors:
      "This change can apply anywhere on the screen, so the screen stays in Changes.",
  },
  component: {
    excludedStylesheet:
      "This stylesheet changed, but none of the changed styles apply to this variant.",
    excludedStylesheets:
      "These stylesheets changed, but none of the changed styles apply to this variant.",
    filesLead: "Changes to these files may affect this component:",
    label: (copy) =>
      copy.replace(/screen/g, "variant").replace(/Screen/g, "Variant"),
    matchedStylesWithSelectors: "Changed styles that apply to this component:",
    matchedStylesWithoutSelectors:
      "Changed styles that apply to this component.",
    noChanges: "No changes to this saved view.",
    unresolvedStylesWithSelectors:
      "This change can apply anywhere on the component, so the component stays in Changes:",
    unresolvedStylesWithoutSelectors:
      "This change can apply anywhere on the component, so the component stays in Changes.",
  },
};

/** Resolve the vocabulary used consistently across one workspace. */
export function entryWording(kind: EntryKind): EntryWording {
  return WORDING[kind];
}
