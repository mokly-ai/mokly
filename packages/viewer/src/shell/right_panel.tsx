/**
 * The right panel of the routed entry: it floats over the canvas's right
 * edge, or opens as the panel's sheet in the compact layout. Its head is the
 * tab strip, Inspect always and Changes where the entry has it, and its body
 * scrolls the selected tab's content while the strip stays. The store holds
 * the selected tab, which survives in-shell navigation to an entry that has
 * it; once the shell knows that an entry has no Changes, Inspect is
 * selected. The body of the other tab stays mounted and hidden, so its
 * folded sections and fields keep their state.
 */

import { useEffect, type ReactNode } from "react";

import { FloatingPanel } from "@mokly/ui/floating-panel";
import {
  PanelTabBody,
  PanelTabs,
  type PanelTab,
  type PanelTabItem,
} from "@mokly/ui/panel-tabs";

import { useShellIdentifierScope } from "./identifier_context.js";
import { usePanelSheet } from "./sheets.js";
import { useShellStore } from "./store_context.js";

const INSPECT: PanelTabItem = { id: "inspect", label: "Inspect" };
const CHANGES: PanelTabItem = { id: "changes", label: "Changes" };

/** The tab that the panel shows: the store's, where the entry has it. */
export function shownPanelTab(stored: PanelTab, hasChanges: boolean): PanelTab {
  return stored === "changes" && hasChanges ? "changes" : "inspect";
}

export function EntryRightPanel({
  changes,
  inspect,
  settled = true,
}: {
  /** The Changes tab's content. Without it, the entry has no Changes tab. */
  changes?: ReactNode;
  inspect: ReactNode;
  /**
   * Whether the shell knows yet whether the entry has Changes, such as once
   * its comparison eligibility is known.
   */
  settled?: boolean | undefined;
}) {
  const store = useShellStore();
  const identifier = useShellIdentifierScope();
  const hasChanges = changes !== undefined;
  const stored = store.state.panelTab;
  const tab = shownPanelTab(stored, hasChanges);
  useEffect(() => {
    if (settled && stored !== tab) store.setPanelTab(tab);
  }, [settled, stored, tab]);
  const tabId = (id: PanelTab) => identifier(`mb-panel-tab-${id}`);
  const panelId = (id: PanelTab) => identifier(`mb-panel-body-${id}`);
  return (
    <FloatingPanel
      head={
        <PanelTabs
          onSelect={(next) => store.setPanelTab(next)}
          panelId={panelId}
          selected={tab}
          tabId={tabId}
          tabs={hasChanges ? [INSPECT, CHANGES] : [INSPECT]}
        />
      }
      label="Panel"
      noun="panel"
      scroll
      sheet={usePanelSheet()}
      side="right"
    >
      <PanelTabBody
        hidden={tab !== "inspect"}
        id={panelId("inspect")}
        labelledBy={tabId("inspect")}
      >
        {inspect}
      </PanelTabBody>
      {hasChanges ? (
        <PanelTabBody
          hidden={tab !== "changes"}
          id={panelId("changes")}
          labelledBy={tabId("changes")}
        >
          {changes}
        </PanelTabBody>
      ) : null}
    </FloatingPanel>
  );
}
