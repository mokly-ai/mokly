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
}

export interface LinkExpectation {
  source: string;
  viewports?: ("mobile" | "desktop")[];
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
  /** The catalogue rows a filtered desktop view keeps. */
  rows?: string[];
}

export const INVENTORY = fixture<DesignInventory>("inventory");

/**
 * A family part of the adoption table: a shared component that every family
 * screen records except the listed ones, or that only the listed screens
 * record, because only they depict it.
 */
export interface AdoptionPart {
  family: string;
  component: string;
  reason: string;
  except?: string[];
  only?: string[];
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
} = fixture<{
  /** Saved variant names in order, by `{group}/{slug}`. */
  sharedComponents: Record<string, string[]>;
  links: LinkExpectation[];
  tagStates: TagState[];
}>("expectations");

/** Design entries that render in both schemes; every other one is light-only. */
export const DUAL_SCHEME =
  /^design\/(browse\/(appearance|loading)\/.+|browse\/views\/(screen|details-screen|screen\/dark-scheme|screen\/light-only)|changes\/diff-controls\/.+|changes\/outcomes\/(changed|difference)|library\/chrome\/(appearance-selector|top-bar)(\/.+)?)$/u;

/** The startup pages draw no catalogue chrome before the index arrives. */
const STARTUP =
  /^design\/browse\/loading\/(catalogue-loading|catalogue-failed|viewer-version)$/u;

/** Screens that depict no selected entry, so they have no screen header. */
const UNSELECTED = new Set([
  "design/browse/views/home",
  "design/browse/states/navigation",
  "design/browse/states/missing-route",
  "design/browse/appearance/status/home",
  "design/browse/appearance/workspaces/drawer",
]);

/** Controls states that show no editable field. */
const FIELDLESS = new Set([
  "design/components/controls/limits/no-props",
  "design/components/controls/limits/read-only",
  "design/components/controls/limits/removed",
  "design/components/controls/published/readonly",
  "design/components/controls/published/readonly-variant",
  "design/components/controls/states/comparison",
]);

/**
 * The shared component ids that one design screen view must record, by the
 * adoption table of the design component library: shared chrome everywhere,
 * the status, view, inspector, field, and flow parts of each family, and the
 * family parts of `adoption.json`.
 */
export function requiredComponents(
  path: string,
  viewport: "mobile" | "desktop",
): string[] {
  if (STARTUP.test(path)) return ["design/library/preview/empty-state"];
  const ids = ["chrome/top-bar", "chrome/appearance-selector"];
  if (viewport === "desktop") ids.push("chrome/catalogue-navigation");
  if (!UNSELECTED.has(path)) ids.push("chrome/screen-header");
  if (path.startsWith("design/browse/loading/"))
    ids.push("preview/empty-state");
  if (path.startsWith("design/changes/"))
    ids.push("inspector/inspector", "inspector/metadata-row");
  if (path.startsWith("design/components/"))
    ids.push(
      "controls/view-controls",
      "controls/change-status",
      "inspector/inspector",
    );
  if (path.startsWith("design/components/controls/") && !FIELDLESS.has(path))
    ids.push("inspector/prop-field");
  if (
    path === "design/browse/views/use-case" ||
    path === "design/browse/appearance/status/flow"
  )
    ids.push("preview/flow-step", "preview/device-frame");
  for (const part of ADOPTION.parts)
    if (
      part.only
        ? part.only.includes(path)
        : new RegExp(ADOPTION.families[part.family]!, "u").test(path) &&
          !part.except!.includes(path)
    )
      ids.push(part.component);
  return [...new Set(ids)].map((id) => `design/library/${id}`);
}
