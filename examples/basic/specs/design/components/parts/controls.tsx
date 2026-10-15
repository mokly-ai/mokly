import type { ComponentPageState } from "./component_details.js";
import { COMPONENT_PAGES } from "./destinations.js";
import {
  COMPONENT_ENTRIES,
  COMPONENT_ENTRY_BY_STATE,
  COMPONENTS,
  type ComponentId,
} from "./metadata.js";
import { VariantBar } from "./variant_bar.js";

/**
 * Stories whose other saved variants changed too, but own no artboard. Their
 * options stay visible without a link to an unrelated story's page.
 */
const UNLINKED_SIBLINGS: ReadonlySet<ComponentPageState> = new Set([
  "style-changed",
]);

interface SavedVariant {
  path: string;
  title: string;
  to?: string;
}

/** Each depicted parent's own entry and the artboard that shows it, if any. */
const PARENTS: Record<ComponentId, SavedVariant> = {
  action: {
    path: COMPONENT_ENTRIES.action.path,
    title: COMPONENTS.action.title,
    to: COMPONENT_PAGES.default,
  },
  toolbar: {
    path: COMPONENT_ENTRIES.toolbar.path,
    title: COMPONENTS.toolbar.title,
    to: COMPONENT_PAGES.toolbar,
  },
  "help-hint": {
    path: COMPONENT_ENTRIES.helpHint.path,
    title: COMPONENTS["help-hint"].title,
    to: COMPONENT_PAGES.hidden,
  },
  badge: {
    path: COMPONENT_ENTRIES.badge.path,
    title: COMPONENTS.badge.title,
    to: COMPONENT_PAGES.unused,
  },
  checklist: {
    path: COMPONENT_ENTRIES.checklist.path,
    title: COMPONENTS.checklist.title,
  },
};

/** Each depicted parent's saved variants in authored order, with their artboards. */
const SAVED_VARIANTS: Record<ComponentId, readonly SavedVariant[]> = {
  action: [
    {
      path: COMPONENT_ENTRIES.actionDefault.path,
      title: "Default",
      to: COMPONENT_PAGES.affected,
    },
    {
      path: COMPONENT_ENTRIES.actionDisabled.path,
      title: "Disabled",
      to: COMPONENT_PAGES.disabled,
    },
    { path: "example/components/action/secondary", title: "Secondary" },
  ],
  toolbar: [{ path: "example/components/toolbar/default", title: "Default" }],
  "help-hint": [
    { path: "example/components/help-hint/default", title: "Default" },
  ],
  badge: [
    {
      path: COMPONENT_ENTRIES.badgeDefault.path,
      title: "Default",
      to: COMPONENT_PAGES.added,
    },
  ],
  checklist: [
    {
      path: COMPONENT_ENTRIES.checklistDefault.path,
      title: "Default",
      to: COMPONENT_PAGES["overlay-tall"],
    },
  ],
};

/**
 * The parent's own entry first, then its saved variants, with the shown entry
 * selected. The removed Compact variant keeps its place in the removed story.
 */
export function VariantPicker({ state }: { state: ComponentPageState }) {
  const shown = COMPONENT_ENTRY_BY_STATE[state];
  const unlinked = UNLINKED_SIBLINGS.has(state);
  const entries: SavedVariant[] = [
    PARENTS[shown.component],
    ...SAVED_VARIANTS[shown.component],
    ...(state === "removed"
      ? [
          {
            path: COMPONENT_ENTRIES.actionCompact.path,
            title: "Compact · Removed",
          },
        ]
      : []),
  ];
  return (
    <VariantBar
      options={entries.map((entry) => {
        const current = entry.path === shown.path;
        const to = current
          ? COMPONENT_PAGES[state]
          : unlinked
            ? undefined
            : entry.to;
        return {
          label: entry.title,
          ...(to ? { to } : {}),
          ...(current ? { current } : {}),
        };
      })}
    />
  );
}
