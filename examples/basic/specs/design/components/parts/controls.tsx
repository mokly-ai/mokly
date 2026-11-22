import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import type { DesignDestination } from "../../parts/destinations.js";

import { COMPONENT_PAGES } from "./destinations.js";
import {
  COMPONENT_ENTRIES,
  COMPONENT_ENTRY_BY_STATE,
  COMPONENTS,
} from "./metadata.js";
import { VariantBar } from "./variant_bar.js";

interface SavedVariant {
  path: string;
  removed?: boolean;
  title: string;
  to?: DesignDestination;
}

/**
 * Action's own entry, then its saved variants in authored order, and the
 * removed Compact variant, which keeps its place in the removed story. Each
 * other entry opens the Canvas artboard that shows it, if one does.
 */
const ACTION_ENTRIES: readonly SavedVariant[] = [
  {
    path: COMPONENT_ENTRIES.action.path,
    title: COMPONENTS.action.title,
    to: CANVAS_PAGES.componentSet,
  },
  {
    path: COMPONENT_ENTRIES.actionDefault.path,
    title: "Default",
    to: CANVAS_PAGES.explorerUsage,
  },
  {
    path: COMPONENT_ENTRIES.actionDisabled.path,
    title: "Disabled",
    to: CANVAS_PAGES.componentSetDisabled,
  },
  { path: "example/components/action/secondary", title: "Secondary" },
  {
    path: COMPONENT_ENTRIES.actionCompact.path,
    removed: true,
    title: "Compact",
  },
];

/** The removed variant's bar, with the shown entry selected. */
export function VariantPicker() {
  const shown = COMPONENT_ENTRY_BY_STATE.removed;
  return (
    <VariantBar
      options={ACTION_ENTRIES.map((entry) => {
        const current = entry.path === shown.path;
        const to = current ? COMPONENT_PAGES.removed : entry.to;
        return {
          label: entry.title,
          path: entry.path,
          ...(entry.removed ? { removed: true } : {}),
          ...(to ? { to } : {}),
          ...(current ? { current } : {}),
        };
      })}
    />
  );
}
