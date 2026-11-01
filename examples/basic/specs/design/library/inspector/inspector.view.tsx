import { useId } from "react";

import { mockLink } from "@mokly/mokly";

import {
  Inspector,
  type InspectorTabId,
} from "../../../../../../packages/ui/src/inspector/inspector.js";

import type { InspectorProps } from "./inspector.js";

/** The shipped name of each saved tab. */
const TAB_IDS = {
  info: "details",
  components: "components",
  props: "props",
  usage: "usage",
} as const satisfies Record<
  InspectorProps["tabs"][number]["id"],
  InspectorTabId
>;

/**
 * The shipped inspector. A static artboard runs no script, so each tab is a
 * native disclosure that opens its panel and closes it again by itself, one
 * tab at a time, and the sheet's grab is a native switch. A tab with a
 * destination links to the artboard that shows the inspector open or closed.
 */
export function InspectorView({
  tabs,
  initial,
  sheetSize,
  ...content
}: InspectorProps) {
  const id = useId();
  const open = initial !== "closed";
  return (
    <Inspector
      active={open ? TAB_IDS[initial] : undefined}
      contentId={`${id}-inspector`}
      disclosures
      expanded={sheetSize === "expanded"}
      interactive={false}
      open={open}
      tabs={tabs.map((tab) => ({
        href:
          tab.destination === undefined ? undefined : mockLink(tab.destination),
        id: TAB_IDS[tab.id],
        panel: content[tab.id],
        panelId: `${id}-panel-${tab.id}`,
        tabId: `${id}-tab-${tab.id}`,
        title: tab.label,
      }))}
    />
  );
}
