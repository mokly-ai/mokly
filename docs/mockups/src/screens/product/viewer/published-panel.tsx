import type { ReactNode } from "react";

import { CompareModes } from "@mokly/ui/compare-modes";
import { FloatingPanel } from "@mokly/ui/floating-panel";
import type { FloatingPanelSheet } from "@mokly/ui/floating-panel";
import { PanelTabBody, PanelTabs } from "@mokly/ui/panel-tabs";
import type { PanelTab, PanelTabItem } from "@mokly/ui/panel-tabs";

import { staticNoop } from "../../../components/static-controls";

const inspectTab: PanelTabItem = { id: "inspect", label: "Inspect" };
const changesTab: PanelTabItem = { id: "changes", label: "Changes" };

/** The ids that join each tab to its body, unique in the drawing's document. */
const tabId = (tab: PanelTab) => "mkc-panel-tab-" + tab;
const panelId = (tab: PanelTab) => "mkc-panel-body-" + tab;

/**
 * The panel's sheet in the compact layout, which every drawing leaves
 * closed: a phone shows the canvas with its dock, and a wide canvas shows
 * the panel whatever its sheet's state is.
 */
const closedSheet: FloatingPanelSheet = {
  expanded: false,
  onClose: staticNoop,
  onExpandedChange: staticNoop,
  open: false,
};

/**
 * The Changes tab's body: what the cloud draws first, such as its Mokly
 * check, then the compare modes at Current, whose tiles are inert text, as
 * the viewer offers them: every mode for shown views that changed, and none
 * otherwise. The publication's comparison evidence is not part of the
 * fixture, so the drawing draws none, and no comparison loaded.
 */
export function PublishedChanges({
  eligible,
  start,
}: {
  /** Whether the shown views changed, which offers the compare modes. */
  eligible: boolean;
  start?: ReactNode;
}) {
  return (
    <>
      {start}
      {eligible ? (
        <CompareModes
          comparable
          interactive={false}
          loaded={false}
          mode="current"
          together={false}
        />
      ) : null}
    </>
  );
}

/**
 * The right panel over the canvas's right edge, as the viewer draws it: the
 * tab strip, Inspect always and Changes where the entry has it, as pictures
 * of the tabs with the shown one current, and the body of the shown tab. A
 * static document shows one tab, so it draws only that tab's body.
 */
export function PublishedPanel({
  changes,
  inspect,
  tab,
}: {
  /** The Changes tab's body. Without it, the entry has no Changes tab. */
  changes?: ReactNode;
  inspect: ReactNode;
  /** The shown tab, which is Inspect when the entry has no Changes. */
  tab: PanelTab;
}) {
  const shown = changes === undefined ? "inspect" : tab;
  return (
    <FloatingPanel
      head={
        <PanelTabs
          interactive={false}
          onSelect={staticNoop}
          panelId={panelId}
          selected={shown}
          tabId={tabId}
          tabs={changes === undefined ? [inspectTab] : [inspectTab, changesTab]}
        />
      }
      interactive={false}
      label="Panel"
      noun="panel"
      scroll
      sheet={closedSheet}
      side="right"
    >
      <PanelTabBody id={panelId(shown)} labelledBy={tabId(shown)}>
        {shown === "changes" ? changes : inspect}
      </PanelTabBody>
    </FloatingPanel>
  );
}
