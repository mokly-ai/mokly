import type { ReactNode } from "react";

import { optional, useDesignInstance } from "../../library/composition.js";
import { floatingPanel } from "../../library/panels/floating-panel.js";
import { panelTabs } from "../../library/panels/panel-tabs.js";
import { useDesignNavigation } from "../../parts/design_navigation.js";

import type { CanvasDestination } from "./destinations.js";
import type { CanvasEntry } from "./entries.js";

/** A tab of the right panel. */
export type PanelTab = "inspect" | "changes";

/**
 * The right panel's tabs: Inspect always, and Changes on an entry that the
 * branch changed, added, removed, or moved, and on an affected entry, which
 * stays unmodified and outside the Changes filter but has an eligible
 * comparison, because a changed component renders in it. The selected tab
 * opens this artboard. The other tab opens the artboard that the navigation
 * state names for it, and stays a picture while no Canvas artboard shows
 * that tab.
 */
function PanelTabs({
  design,
  entry,
  selected,
}: {
  design: CanvasDestination;
  entry: CanvasEntry;
  selected: PanelTab;
}) {
  const transitions = useDesignNavigation().canvas ?? {};
  const destination = (tab: PanelTab, other: CanvasDestination | undefined) =>
    optional("destination", tab === selected ? design : other);
  return (
    <panelTabs.Component
      moklyInstance={useDesignInstance("panel-tabs")}
      tabs={[
        {
          id: "inspect",
          label: "Inspect",
          ...destination("inspect", transitions.inspectTab),
        },
        ...(entry.changed
          ? [
              {
                id: "changes" as const,
                label: "Changes",
                ...destination("changes", transitions.changesTab),
              },
            ]
          : []),
      ]}
      selected={selected}
    />
  );
}

/**
 * The floating right panel: the tab strip in its head, and the selected
 * tab's body. In the compact form it is the panel sheet, with the same tabs.
 */
export function RightPanel({
  children,
  close,
  design,
  entry,
  selected,
  sheet,
}: {
  children: ReactNode;
  close?: CanvasDestination | undefined;
  design: CanvasDestination;
  entry: CanvasEntry;
  selected: PanelTab;
  sheet: boolean;
}) {
  return (
    <floatingPanel.Component
      moklyInstance={useDesignInstance("right-panel")}
      side="right"
      label="Panel"
      sheet={sheet}
      {...optional("closeDestination", sheet ? close : undefined)}
      head={<PanelTabs design={design} entry={entry} selected={selected} />}
    >
      <div className="cv-ins">{children}</div>
    </floatingPanel.Component>
  );
}
