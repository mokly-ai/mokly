import { mockLink } from "@mokly/mokly";

import { useCurrentPage } from "../../parts/design_navigation.js";

import type { PanelTabsProps } from "./panel-tabs.js";

/**
 * The right panel's tab strip: text tabs on the panel head's hairline. The
 * selected tab is ink at 600 over a 2px signal rule, and every label keeps
 * the width of its bold form, so selecting a tab moves nothing. A static
 * artboard runs no script, so a tab links to the artboard that shows its
 * panel, and a tab without one is a picture of itself.
 */
export function PanelTabsView({ selected, tabs }: PanelTabsProps) {
  const current = useCurrentPage();
  return (
    <div className="cv-ptabs">
      {tabs.map((tab) => {
        const chosen = tab.id === selected;
        const label = (
          <span className="cv-ptab-label" data-text={tab.label}>
            {tab.label}
          </span>
        );
        return tab.destination === undefined ? (
          <span
            aria-current={chosen ? "true" : undefined}
            className="cv-ptab"
            data-selected={chosen ? "" : undefined}
            data-tab={tab.id}
            key={tab.id}
          >
            {label}
          </span>
        ) : (
          <a
            aria-current={
              current(tab.destination) ?? (chosen ? "true" : undefined)
            }
            className="cv-ptab"
            data-selected={chosen ? "" : undefined}
            data-tab={tab.id}
            href={mockLink(tab.destination)}
            key={tab.id}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
