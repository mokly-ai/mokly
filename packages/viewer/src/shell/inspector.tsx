/**
 * The shared tabbed inspector, kept outside the scrolling preview. This
 * container reads the store and the identifier scope, and it closes the
 * inspector on Escape anywhere in its shell root. `@mokly/ui/inspector`
 * renders the tabs and the panels, with the tab keys and the focus return.
 */

import { useEffect, useRef, type ReactNode } from "react";

import {
  Inspector as InspectorView,
  type InspectorHandle,
  type InspectorTab,
  type InspectorTabId,
} from "@mokly/ui/inspector";

import type { Catalogue } from "./catalogue.js";
import { CONTROLS_COPY } from "./component_controls_copy.js";
import { EntryDetailsBody } from "./details.js";
import {
  useShellIdentifier,
  useShellIdentifierScope,
} from "./identifier_context.js";
import { useOptionalShellStore } from "./store_context.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceEvidenceEntry } from "./workspace_entry.js";
import { selectedVariant } from "./workspace_selection.js";
import { selectedChangedViews } from "./workspace_views_data.js";

/** React content supplied by the owning workspace for each dynamic panel. */
export interface InspectorPanels {
  components?: ReactNode;
  details?: ReactNode;
  props: ReactNode;
  usage: ReactNode;
}

/** Accessible inspector tabs with one shown panel at a time. */
export function Inspector({
  catalogue,
  data,
  panels,
}: {
  catalogue: Catalogue;
  data: WorkspaceData;
  panels: InspectorPanels;
}) {
  const store = useOptionalShellStore();
  const contentId = useShellIdentifier("mb-inspector-content");
  const identifier = useShellIdentifierScope();
  const variant = selectedVariant(data).variant;
  const changedViews = selectedChangedViews(
    workspaceEvidenceEntry(data),
    data.changedViews,
    variant?.value.path,
  );
  const tab = (
    id: InspectorTabId,
    title: string,
    panel: ReactNode,
  ): InspectorTab => ({
    id,
    panel,
    panelId: identifier(`mb-panel-${id}`),
    tabId: identifier(`mb-tab-${id}`),
    title,
  });
  const tabs = [
    tab(
      "details",
      "Details",
      <>
        <EntryDetailsBody
          catalogue={catalogue}
          changedViews={changedViews}
          entry={data.entry}
        />
        {panels.details}
      </>,
    ),
    ...(panels.components
      ? [
          tab(
            "components",
            data.entry.kind === "component"
              ? "Nested components"
              : "Components",
            panels.components,
          ),
        ]
      : []),
    tab("props", CONTROLS_COPY.tab, panels.props),
    tab("usage", "Usage", panels.usage),
  ];
  const open = store?.state.detailsOpen ?? false;
  const interactive = store?.interactive ?? false;
  const inspector = useRef<InspectorHandle>(null);
  // Escape anywhere in the shell root closes an open inspector.
  useEffect(() => {
    if (!interactive || !open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      inspector.current?.close();
    };
    const root =
      inspector.current?.element?.closest<HTMLElement>("[data-mokly-shell]");
    root?.addEventListener("keydown", escape);
    return () => root?.removeEventListener("keydown", escape);
  }, [interactive, open]);
  return (
    <InspectorView
      active={store?.state.inspectorTab}
      contentId={contentId}
      interactive={interactive}
      onOpenChange={(next, id) => store?.setDetails(next, id)}
      open={open}
      ref={inspector}
      tabs={tabs}
    />
  );
}
