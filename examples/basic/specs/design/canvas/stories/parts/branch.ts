import type { NavNode } from "../../../parts/nav.js";
import type { CatalogueView } from "../../parts/catalogue.js";
import type { ComponentIdentity } from "../../parts/component_identity.js";
import type { CanvasDestination } from "../../parts/destinations.js";
import type { CanvasEntry } from "../../parts/entries.js";
import { CANVAS_ALL_ROWS, retarget } from "../../parts/nav_rows.js";
import type { PanelTab } from "../../parts/panel.js";

import { STORY_PAGES as S } from "./destinations.js";

/*
 * The Storybook stories branch, synthetic content of these artboards and
 * never product data. The catalogue also holds a Menu stories file, and the
 * configuration gives the URL of the published Storybook. The file holds
 * three stories in source order: Collapsed, the first one, renders the
 * Menu's own page, and Expanded and Disabled are its variants. On this
 * branch the Menu opens its list through a portal into `document.body`, so
 * Expanded no longer renders on the server, and Mokly writes an error
 * document in place of each of its views. The branch also adds Disabled.
 * Two Changes rows: Expanded, changed, and Disabled, added.
 */

/** The Menu stories file as the Canvas family shows it. */
export const MENU: ComponentIdentity = {
  title: "Menu",
  description: "A list of actions that opens from a button.",
  path: "example/components/Menu",
  source: "src/components/Menu.stories.tsx",
  tags: [],
};

/** A story of the Menu stories file, as its entry shows it. */
export interface MenuStory {
  /** The slug of the story's row on the variant set. */
  slug: "menu" | "expanded" | "disabled";
  /** The story's name, as Storybook names it. */
  story: string;
  /** The row's title on the variant set and in the Variants list. */
  title: string;
  entry: CanvasEntry;
  /** The page of an added entry has no Storybook link. */
  storybook: boolean;
}

/** The Menu's three stories, in source order. */
export const MENU_STORIES = {
  menu: {
    slug: "menu",
    story: "Collapsed",
    title: MENU.title,
    storybook: true,
    entry: {
      title: MENU.title,
      slug: "menu",
      path: MENU.path,
      kind: "component",
      // Unmodified, yet its set shows the changed Expanded row, so its
      // canvas offers the compare modes and the panel has Changes.
      changed: true,
    },
  },
  expanded: {
    slug: "expanded",
    story: "Expanded",
    title: "Expanded",
    storybook: true,
    entry: {
      title: MENU.title,
      slug: "menu",
      path: `${MENU.path}/Expanded`,
      kind: "component",
      status: "changed",
      changed: true,
    },
  },
  disabled: {
    slug: "disabled",
    story: "Disabled",
    title: "Disabled",
    storybook: false,
    entry: {
      title: MENU.title,
      slug: "menu",
      path: `${MENU.path}/Disabled`,
      kind: "component",
      status: "added",
      changed: true,
    },
  },
} as const satisfies Record<string, MenuStory>;

/** The key of the Menu's row, and of each story's row, in the catalogue. */
export const STORY_KEYS = {
  menu: MENU.path,
  expanded: MENU_STORIES.expanded.entry.path,
  disabled: MENU_STORIES.disabled.entry.path,
} as const;

/** The branch's two changes in the Changes filter's order. */
export const STORY_CHANGES = {
  total: 2,
  expandedPosition: 1,
  disabledPosition: 2,
} as const;

/** The Menu's row and its stories' rows, below the Components folder. */
function menuRows(depth: number): NavNode[] {
  const story = (key: string, label: string): NavNode => ({
    key,
    changed: true,
    depth: depth + 1,
    kind: "variant",
    label,
    variantParentKind: "component",
  });
  return [
    {
      key: STORY_KEYS.menu,
      changed: true,
      depth,
      kind: "component",
      label: MENU.title,
      variants: "open",
    },
    story(STORY_KEYS.expanded, MENU_STORIES.expanded.title),
    story(STORY_KEYS.disabled, MENU_STORIES.disabled.title),
  ];
}

/**
 * The branch in the Changes filter: Example's Components folder over the
 * Menu, which carries the aggregate mark of its changed and added stories.
 */
const CHANGES_ROWS: readonly NavNode[] = [
  { key: "example", depth: 0, kind: "folder", label: "Example", open: true },
  {
    key: "example-components",
    depth: 1,
    kind: "folder",
    label: "Components",
    open: true,
  },
  ...menuRows(2),
];

/**
 * The branch in All: the whole catalogue with the Menu after the Toolbar in
 * Example's Components folder. Only the Menu's rows open an artboard of this
 * branch, so every other row is a picture.
 */
function allRows(): NavNode[] {
  const rows = CANVAS_ALL_ROWS.map((row) => retarget(row, undefined));
  const components = rows.findIndex((row) => row.key === "example-components");
  const folder = rows[components];
  if (folder === undefined) throw new Error("Example has no Components row.");
  const end = rows.findIndex(
    (row, index) => index > components && row.depth <= folder.depth,
  );
  const at = end === -1 ? rows.length : end;
  return [
    ...rows.slice(0, at),
    ...menuRows(folder.depth + 1),
    ...rows.slice(at),
  ];
}

/** The artboard of each story's row, by the right panel's tab. */
const STORY_TARGETS: Readonly<
  Record<PanelTab, Readonly<Record<MenuStory["slug"], CanvasDestination>>>
> = {
  inspect: {
    menu: S.storybookLink,
    expanded: S.storyFailed,
    disabled: S.storyAdded,
  },
  changes: {
    menu: S.storybookLink,
    expanded: S.storyFailedChanges,
    disabled: S.storyAdded,
  },
};

/** The Menu's first changed story in source order, which its row opens in Changes. */
const FIRST_CHANGED = (
  Object.values(MENU_STORIES) as readonly MenuStory[]
).find((story) => story.entry.status !== undefined);

/** The rows of the Menu's stories, by their keys. */
function rowTargets(tab: PanelTab): Record<string, CanvasDestination> {
  const targets = STORY_TARGETS[tab];
  return {
    [STORY_KEYS.menu]: targets.menu,
    [STORY_KEYS.expanded]: targets.expanded,
    [STORY_KEYS.disabled]: targets.disabled,
  };
}

/**
 * The branch's catalogue in the Changes filter, with one row selected. The
 * Menu's own row there opens its first changed story, Expanded, on the same
 * tab, as an aggregate row in Changes does. Where Expanded is the selected
 * row, that artboard is the shown one, so the Menu's row is a picture.
 */
export function storyChanges(activeKey: string, tab: PanelTab): CatalogueView {
  if (FIRST_CHANGED === undefined)
    throw new Error("The stories branch changes a story of the Menu.");
  const first = STORY_KEYS[FIRST_CHANGED.slug];
  const { [STORY_KEYS.menu]: _own, ...targets } = rowTargets(tab);
  return {
    filter: "changes",
    activeKey,
    rows: CHANGES_ROWS,
    targets:
      activeKey === first
        ? targets
        : {
            ...targets,
            [STORY_KEYS.menu]: STORY_TARGETS[tab][FIRST_CHANGED.slug],
          },
    changedCount: STORY_CHANGES.total,
  };
}

/** The branch's catalogue in All, with the Menu's own row selected. */
export function storyAll(activeKey: string): CatalogueView {
  return {
    filter: "all",
    activeKey,
    rows: allRows(),
    targets: rowTargets("inspect"),
    changedCount: STORY_CHANGES.total,
  };
}
