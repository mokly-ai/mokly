import fs from "node:fs";

/**
 * Expected facts about the example's design catalogue. The fixtures hold the
 * frozen design-screen inventory, the shared component library with its
 * saved variants, and a small semantic set of link destinations per control
 * family; this module adds the shared components each design family adopts.
 */

function fixture<T>(name: string): T {
  return JSON.parse(
    fs.readFileSync(
      new URL(`../fixtures/design/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as T;
}

export interface DesignInventory {
  /** Every design screen path, in order. */
  screens: string[];
  /**
   * The states that, by the design links contract, runtime transitions and
   * the catalogue tree reach: the loading and recovery screens, the editing
   * preparation states, the Screen props state, and the Read-only and
   * recovery gallery.
   */
  runtimeOnly: string[];
  /** Other screens that no design artboard links to yet; the tree opens them. */
  treeReached: string[];
  /** The failure states whose retry may open each runtime-only state. */
  retries: Record<string, string[]>;
}

export interface LinkExpectation {
  source: string;
  viewports?: ("mobile" | "desktop")[];
  /**
   * The schemes of the views that hold the link, where a view's link differs
   * by scheme, such as the frame that a phone opens on; every scheme by
   * default.
   */
  colorSchemes?: ("light" | "dark")[];
  /** A class that a matching link sits inside, such as the stage's pane. */
  within?: string;
  /** The link's accessible name: its `aria-label`, or else its text. */
  name?: string;
  namePattern?: string;
  /** The expected `data-mokly-link`, or null for a depiction without a link. */
  target: string | null;
}

export interface TagState {
  path: string;
  query: string;
  picker: boolean;
  active: string[];
  /** The search field's tag control: it opens or closes the picker. */
  toggle: string;
  /**
   * The destination of each tag's chip: an inactive chip enters its tag, and
   * an active chip clears it.
   */
  chips: Record<string, string>;
  /** The catalogue rows a filtered desktop view keeps. */
  rows?: string[];
}

type ViewFact =
  | { path: string; alert: string }
  | { path: string; label: string; defaultPreview: string }
  | { path: string; story: string; storybook: boolean };

export const INVENTORY = fixture<DesignInventory>("inventory");

/**
 * A family part of the adoption table: a shared component that every family
 * screen records except the listed ones, or that only the listed screens
 * record, because only they depict it. A part limited to some viewports
 * binds only their views, such as a panel that a phone shows as a sheet only
 * on the screens that open it.
 */
export interface AdoptionPart {
  family: string;
  component: string;
  reason: string;
  except?: string[];
  only?: string[];
  viewports?: ("mobile" | "desktop")[];
}

export const ADOPTION = fixture<{
  /** Each family's path pattern. */
  families: Record<string, string>;
  parts: AdoptionPart[];
}>("adoption");

export const {
  sharedComponents: SHARED_COMPONENTS,
  links,
  tagStates,
  viewFacts,
} = fixture<{
  /** Saved variant names in order, by `{group}/{slug}`. */
  sharedComponents: Record<string, string[]>;
  links: LinkExpectation[];
  tagStates: TagState[];
  viewFacts: ViewFact[];
}>("expectations");

/** Design entries that render in both schemes; every other one is light-only. */
export const DUAL_SCHEME =
  /^design\/(canvas\/.+|library\/chrome\/(appearance-selector|top-bar)(\/.+)?)$/u;

/** The startup pages draw no catalogue chrome before the index arrives. */
const STARTUP = /^design\/canvas\/loading\/catalogue(\/failed|\/version)?$/u;

/**
 * The shared component ids that one design screen view must record, by the
 * adoption table of the design component library: shared chrome everywhere
 * and the family parts of `adoption.json`.
 */
export function requiredComponents(
  path: string,
  viewport: "mobile" | "desktop",
): string[] {
  if (STARTUP.test(path)) return ["design/library/preview/empty-state"];
  const ids = ["chrome/top-bar", "chrome/appearance-selector"];
  if (viewport === "desktop") ids.push("chrome/catalogue-navigation");
  for (const part of ADOPTION.parts)
    if (
      (part.viewports ?? [viewport]).includes(viewport) &&
      (part.only
        ? part.only.includes(path)
        : new RegExp(ADOPTION.families[part.family]!, "u").test(path) &&
          !part.except!.includes(path))
    )
      ids.push(part.component);
  return [...new Set(ids)].map((id) => `design/library/${id}`);
}
