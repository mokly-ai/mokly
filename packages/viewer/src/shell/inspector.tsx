/** Shared tabbed inspector kept outside the scrolling preview. */

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import type { Catalogue } from "./catalogue.js";
import { EntryDetailsBody } from "./details.js";
import {
  useShellIdentifier,
  useShellIdentifierScope,
} from "./identifier_context.js";
import { useOptionalShellStore } from "./store_context.js";
import type { ChangedView } from "./view_marks.js";
import type { WorkspaceData } from "./workspace_data.js";
import { WorkspaceIcon, type WorkspaceIconName } from "./workspace_icons.js";

/** React content supplied by the owning workspace for each dynamic panel. */
export interface InspectorPanels {
  components?: ReactNode;
  details?: ReactNode;
  props: ReactNode;
  usage: ReactNode;
}

/** Accessible inspector tabs with one mounted panel at a time. */
export function Inspector({
  catalogue,
  changedViews,
  data,
  panels,
}: {
  catalogue: Catalogue;
  changedViews?: readonly ChangedView[];
  data: WorkspaceData;
  panels: InspectorPanels;
}) {
  const store = useOptionalShellStore();
  const contentId = useShellIdentifier("mb-inspector-content");
  const identifier = useShellIdentifierScope();
  const tabId = (id: WorkspaceIconName) => identifier(`mb-tab-${id}`);
  const panelId = (id: WorkspaceIconName) => identifier(`mb-panel-${id}`);
  const tabs: { id: WorkspaceIconName; title: string }[] = [
    { id: "details", title: "Details" },
    ...(panels.components
      ? [
          {
            id: "components" as const,
            title:
              data.entry.kind === "component"
                ? "Nested components"
                : "Components",
          },
        ]
      : []),
    { id: "props", title: "Props" },
    { id: "usage", title: "Usage" },
  ];
  const active = store?.state.inspectorTab;
  const open = store?.state.detailsOpen ?? false;
  const previousTab = useRef<HTMLElement | null>(null);
  const inspector = useRef<HTMLElement>(null);
  const select = (id: string, target: HTMLElement) => {
    previousTab.current = target;
    store?.setDetails(!(open && active === id), id);
  };
  const close = useCallback(() => {
    store?.setDetails(false);
    previousTab.current?.focus({ preventScroll: true });
  }, [store]);
  useEffect(() => {
    if (!store?.interactive || !open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    const root = inspector.current?.closest<HTMLElement>("[data-mokly-shell]");
    root?.addEventListener("keydown", escape);
    return () => root?.removeEventListener("keydown", escape);
  }, [close, open, store?.interactive]);
  return (
    <section
      aria-label="Inspector"
      className="mbk-inspector"
      data-open={store?.interactive ? String(open) : undefined}
      data-workspace-inspector=""
      onKeyDown={(event) => onInspectorKeyDown(event, tabs.length)}
      ref={inspector}
    >
      <div
        aria-controls={contentId}
        aria-label="Resize inspector"
        aria-orientation="horizontal"
        aria-valuemax={600}
        aria-valuemin={160}
        aria-valuenow={260}
        className="mbk-inspector-resize"
        data-inspector-resize=""
        role="separator"
        tabIndex={0}
      />
      <button
        aria-expanded="false"
        aria-label="Expand inspector"
        className="mbk-sheet-grab"
        data-inspector-size=""
        type="button"
      >
        <span />
      </button>
      <div
        aria-label="Inspector panels"
        className="mbk-inspector-tabs"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-controls={panelId(tab.id)}
            aria-label={tab.title}
            aria-selected={open && active === tab.id}
            className="mbk-icon-button"
            data-inspector-tab={tab.id}
            id={tabId(tab.id)}
            key={tab.id}
            onClick={(event) => select(tab.id, event.currentTarget)}
            role="tab"
            title={tab.title}
            type="button"
          >
            <WorkspaceIcon name={tab.id} />
          </button>
        ))}
        <span className="mbk-inspector-title" data-inspector-title="">
          {open ? tabs.find((tab) => tab.id === active)?.title : null}
        </span>
        <button
          aria-label="Close inspector"
          className="mbk-icon-button"
          data-inspector-close=""
          hidden={!open}
          onClick={close}
          title="Close inspector"
          type="button"
        >
          <WorkspaceIcon name="close" />
        </button>
      </div>
      <div
        className="mbk-inspector-content"
        data-mokly-scroll="inspector"
        hidden={!open}
        id={contentId}
      >
        {tabs.map((tab) => (
          <section
            aria-labelledby={tabId(tab.id)}
            data-inspector-panel={tab.id}
            hidden={!open || active !== tab.id}
            id={panelId(tab.id)}
            key={tab.id}
            role="tabpanel"
          >
            {panelContent(tab.id, catalogue, changedViews, data, panels)}
          </section>
        ))}
      </div>
    </section>
  );
}

function panelContent(
  id: WorkspaceIconName,
  catalogue: Catalogue,
  changedViews: readonly ChangedView[] | undefined,
  data: WorkspaceData,
  panels: InspectorPanels,
): ReactNode {
  if (id === "details")
    return (
      <>
        <EntryDetailsBody
          catalogue={catalogue}
          changedViews={changedViews}
          entry={data.entry}
        />
        {panels.details}
      </>
    );
  if (id === "components") return panels.components;
  if (id === "props") return panels.props;
  if (id === "usage") return panels.usage;
  return null;
}

function onInspectorKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  count: number,
): void {
  const target = event.target;
  if (
    !(target instanceof HTMLElement) ||
    !target.matches("[data-inspector-tab]") ||
    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
  )
    return;
  event.preventDefault();
  const tabs = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      "[data-inspector-tab]",
    ),
  ];
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? count - 1
        : (tabs.indexOf(target) +
            (event.key === "ArrowRight" ? 1 : count - 1)) %
          count;
  tabs[next]?.focus();
}
