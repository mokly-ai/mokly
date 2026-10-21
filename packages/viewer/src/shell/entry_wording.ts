/** Shared copy for screen, component and whole-document page Details. */

/** Entry kinds whose comparison copy differs. */
export type EntryKind = "screen" | "component" | "page";

/** Product wording selected for one Details entry kind. */
export interface EntryWording {
  readonly excludedStylesheet: string;
  readonly excludedStylesheets: string;
  readonly filesLead: string;
  label(copy: string): string;
  readonly matchedStylesWithSelectors: string;
  readonly matchedStylesWithoutSelectors: string;
  readonly noChanges: string;
  /** Proven page matches from rules that changed no component. */
  readonly pageStyles: string;
  /** Proven page matches from rules that also changed a component. */
  readonly pageOutsideStyles: string;
  /** A rule that gives the page its own row because it can reach anything. */
  readonly pageUnresolvedWithSelectors: string;
  readonly pageUnresolvedWithoutSelectors: string;
  /** The pane heading of a changed view that only its stylesheets prove. */
  readonly stylesChanged: string;
  /** The pane heading of an unchanged view that changed components affect. */
  readonly componentsChanged: string;
  readonly unresolvedStylesWithSelectors: string;
  readonly unresolvedStylesWithoutSelectors: string;
}

/**
 * Wording of a screen or a component. A whole-document page has no usage
 * records, so changed components never affect it and its wording has no
 * shared-component sentence.
 */
interface ConsumerWording extends EntryWording {
  /** Details of an entry that only changed components affect end with it. */
  readonly sharedImpact: string;
}

/** The words that every sentence of one kind takes, each from one place. */
interface EntryNouns {
  /** The shown entry. Component copy names it a variant, also on the parent. */
  readonly entry: string;
  /** How the outside-match sentence places changed components in the entry. */
  readonly within: "in" | "on";
  /**
   * The catalogue item that the file list and the matched and unresolved
   * sentences name: the entry itself, or in a component workspace the
   * component, whose own rules can sit beside its variant's under one file.
   */
  readonly item: string;
}

/**
 * Each kind's nouns, as the CSS evidence presentation contract fixes them.
 * Every sentence of a kind is built from its nouns, so that no kind can name
 * one thing with two words.
 */
export const ENTRY_NOUNS = {
  screen: { entry: "screen", within: "on", item: "screen" },
  component: { entry: "variant", within: "in", item: "component" },
  page: { entry: "page", within: "on", item: "page" },
} as const satisfies Record<EntryKind, EntryNouns>;

/** The paired matched and unresolved sentences, with or without a list. */
const applies = (noun: string, end: ":" | ".") =>
  `Changed styles that apply to this ${noun}${end}`;
const anywhere = (noun: string, end: ":" | ".") =>
  `This change can apply anywhere on the ${noun}, so the ${noun} stays in Changes${end}`;

/** Every sentence of one kind, from that kind's nouns. */
function wordingOf({ entry, within, item }: EntryNouns): EntryWording {
  const capitalized = entry.charAt(0).toUpperCase() + entry.slice(1);
  const excluded = `changed, but none of the changed styles apply to this ${entry}.`;
  return {
    excludedStylesheet: `This stylesheet ${excluded}`,
    excludedStylesheets: `These stylesheets ${excluded}`,
    filesLead: `Changes to these files may affect this ${item}:`,
    // Recasts the comparison panes' screen copy for the entry.
    label: (copy) =>
      copy.replace(/screen/g, entry).replace(/Screen/g, capitalized),
    matchedStylesWithSelectors: applies(item, ":"),
    matchedStylesWithoutSelectors: applies(item, "."),
    noChanges: `No changes to this ${entry}.`,
    pageStyles: applies(entry, ":"),
    pageOutsideStyles: `These changed styles also apply outside the changed components ${within} this ${entry}:`,
    pageUnresolvedWithSelectors: anywhere(entry, ":"),
    pageUnresolvedWithoutSelectors: anywhere(entry, "."),
    stylesChanged: `Styles this ${entry} uses changed`,
    componentsChanged: `Components this ${entry} uses changed`,
    unresolvedStylesWithSelectors: anywhere(item, ":"),
    unresolvedStylesWithoutSelectors: anywhere(item, "."),
  };
}

/** A screen's or a component's wording, with its shared-component sentence. */
function consumerWordingOf(nouns: EntryNouns): ConsumerWording {
  return {
    ...wordingOf(nouns),
    sharedImpact: `Changed components that this ${nouns.entry} uses affect its preview.`,
  };
}

const WORDING: {
  readonly screen: ConsumerWording;
  readonly component: ConsumerWording;
  readonly page: EntryWording;
} = {
  screen: consumerWordingOf(ENTRY_NOUNS.screen),
  component: consumerWordingOf(ENTRY_NOUNS.component),
  page: wordingOf(ENTRY_NOUNS.page),
};

/** Resolve the vocabulary used consistently across one entry's Details. */
export function entryWording<Kind extends EntryKind>(
  kind: Kind,
): (typeof WORDING)[Kind] {
  return WORDING[kind];
}
