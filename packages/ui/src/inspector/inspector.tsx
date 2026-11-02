/**
 * The workspace inspector below the preview: a strip of tabs, the title of
 * the open tab, Close, and one panel for each tab, of which the open tab's
 * shows. The arrow keys, Home, and End move focus between the tabs. Close
 * returns focus to the tab that the reader pressed last. A host closes the
 * inspector the same way through the handle, such as on Escape anywhere in
 * its shell, and moves focus to a tab through it. The host sizes the
 * inspector through the resize separator and the sheet grab of
 * `inspector-sizer.tsx`. A static depiction that runs no script draws each
 * tab as a native disclosure instead.
 */

import {
  useCallback,
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
} from "react";

import { WorkspaceIcon } from "../icons/icons.js";

import { InspectorDisclosures } from "./inspector-disclosures.js";
import {
  InspectorSizer,
  sizeStyle,
  type InspectorSizing,
} from "./inspector-sizer.js";
import { onTabKeyDown } from "./tab-keys.js";

export type { InspectorSizing } from "./inspector-sizer.js";

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
  /**
   * The address that the tab of a static depiction opens, such as another
   * document that shows the inspector open or closed. The tab is then a
   * link, which is its one keyboard stop.
   */
  href?: string | undefined;
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
  /**
   * Move focus to a tab, such as Props when the reader picks an instance.
   * Nothing opens or closes.
   */
  focusTab(id: InspectorTabId): void;
}

export function Inspector({
  active,
  contentId,
  contentRef,
  disclosures = false,
  interactive,
  onOpenChange,
  open,
  ref,
  tabs,
  ...size
}: InspectorSizing & {
  /** The tab that the host shows while the inspector is open. */
  active?: string | undefined;
  /** The id of the panels' region, unique in the document. */
  contentId: string;
  /** Receives the panels' region, whose scroll position the host keeps. */
  contentRef?: Ref<HTMLDivElement> | undefined;
  /**
   * Whether each tab is a native disclosure, for a static depiction that runs
   * no script. A tab then opens its panel and closes it again by itself, one
   * tab at a time, and the sheet's grab is a native switch. `contentId` names
   * the tabs' group. Of the size, such an inspector takes only `expanded`.
   */
  disclosures?: boolean;
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
  const tabButtons = useRef(new Map<InspectorTabId, HTMLButtonElement>());
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
      focusTab(id) {
        tabButtons.current.get(id)?.focus({ preventScroll: true });
      },
    }),
    [close],
  );
  const select = (id: InspectorTabId, target: HTMLElement) => {
    previousTab.current = target;
    onOpenChange?.(!(open && active === id), id);
  };
  if (disclosures)
    return (
      <InspectorDisclosures
        active={active}
        contentId={contentId}
        expanded={size.expanded ?? false}
        open={open}
        tabs={tabs}
      />
    );
  return (
    <section
      aria-label="Inspector"
      className="mbk-inspector mbk-reset"
      data-expanded={
        size.expanded === undefined ? undefined : String(size.expanded)
      }
      data-open={interactive ? String(open) : undefined}
      data-workspace-inspector=""
      onKeyDown={(event) => onTabKeyDown(event, tabs.length)}
      ref={section}
      style={sizeStyle(size)}
    >
      <InspectorSizer contentId={contentId} {...size} />
      <div
        aria-label="Inspector panels"
        className="mbk-inspector-tabs mbk-reset"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-controls={tab.panelId}
            aria-label={tab.title}
            aria-selected={open && active === tab.id}
            className="mbk-icon-button mbk-reset"
            data-inspector-tab={tab.id}
            id={tab.tabId}
            key={tab.id}
            onClick={(event) => select(tab.id, event.currentTarget)}
            ref={(button) => {
              if (!button) return;
              tabButtons.current.set(tab.id, button);
              return () => {
                tabButtons.current.delete(tab.id);
              };
            }}
            role="tab"
            title={tab.title}
            type="button"
          >
            <WorkspaceIcon name={tab.id} />
          </button>
        ))}
        <span className="mbk-inspector-title mbk-reset" data-inspector-title="">
          {open ? tabs.find((tab) => tab.id === active)?.title : null}
        </span>
        <button
          aria-label="Close inspector"
          className="mbk-icon-button mbk-reset"
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
        className="mbk-inspector-content mbk-reset"
        data-mokly-scroll="inspector"
        hidden={!open}
        id={contentId}
        ref={contentRef}
      >
        {tabs.map((tab) => (
          <section
            aria-labelledby={tab.tabId}
            className="mbk-reset"
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
