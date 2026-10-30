/**
 * The workspace inspector below the preview: a strip of tabs, the title of
 * the open tab, Close, and one panel for each tab, of which the open tab's
 * shows. The arrow keys, Home, and End move focus between the tabs. Close
 * returns focus to the tab that the reader pressed last. A host closes the
 * inspector the same way through the handle, such as on Escape anywhere in
 * its shell. The resize separator and the sheet grab carry the attributes
 * through which the host sizes the inspector.
 */

import {
  useCallback,
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
} from "react";

import { WorkspaceIcon } from "../icons/icons.js";

import { onTabKeyDown } from "./tab-keys.js";

/** The tabs of the inspector, each with its glyph. */
export type InspectorTabId = "details" | "components" | "props" | "usage";

/** One tab of the inspector, with its panel. */
export interface InspectorTab {
  id: InspectorTabId;
  /** The tab's accessible name and tooltip, and its panel's title. */
  title: string;
  /** The id of the tab, unique in the document. */
  tabId: string;
  /** The id of the tab's panel, unique in the document. */
  panelId: string;
  /** The panel's content. */
  panel: ReactNode;
}

/** What a host can ask of the inspector that it renders. */
export interface InspectorHandle {
  /** The inspector's element, from which a host can find its shell. */
  readonly element: HTMLElement | null;
  /**
   * Ask to close the inspector, and return focus to the tab that the reader
   * pressed last.
   */
  close(): void;
}

export function Inspector({
  active,
  contentId,
  interactive,
  onOpenChange,
  open,
  ref,
  tabs,
}: {
  /** The tab that the host shows while the inspector is open. */
  active?: string | undefined;
  /** The id of the panels' region, unique in the document. */
  contentId: string;
  /**
   * Whether a script runs, which marks the inspector with its open state for
   * the stylesheet.
   */
  interactive: boolean;
  /**
   * Receives the open state and the tab that a tab or Close asks for. A tab
   * opens its panel, and the open tab closes the inspector.
   */
  onOpenChange?: ((open: boolean, tab?: InspectorTabId) => void) | undefined;
  open: boolean;
  /** Receives the handle through which the host closes the inspector. */
  ref?: Ref<InspectorHandle> | undefined;
  /** The tabs in their order. */
  tabs: readonly InspectorTab[];
}) {
  const section = useRef<HTMLElement>(null);
  const previousTab = useRef<HTMLElement | null>(null);
  const close = useCallback(() => {
    onOpenChange?.(false);
    previousTab.current?.focus({ preventScroll: true });
  }, [onOpenChange]);
  useImperativeHandle(
    ref,
    () => ({
      get element() {
        return section.current;
      },
      close,
    }),
    [close],
  );
  const select = (id: InspectorTabId, target: HTMLElement) => {
    previousTab.current = target;
    onOpenChange?.(!(open && active === id), id);
  };
  return (
    <section
      aria-label="Inspector"
      className="mbk-inspector"
      data-open={interactive ? String(open) : undefined}
      data-workspace-inspector=""
      onKeyDown={(event) => onTabKeyDown(event, tabs.length)}
      ref={section}
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
            aria-controls={tab.panelId}
            aria-label={tab.title}
            aria-selected={open && active === tab.id}
            className="mbk-icon-button"
            data-inspector-tab={tab.id}
            id={tab.tabId}
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
            aria-labelledby={tab.tabId}
            data-inspector-panel={tab.id}
            hidden={!open || active !== tab.id}
            id={tab.panelId}
            key={tab.id}
            role="tabpanel"
          >
            {tab.panel}
          </section>
        ))}
      </div>
    </section>
  );
}
