/**
 * The inspector of a static depiction that runs no script. Each tab is a
 * native disclosure of one group, so a tab opens its panel and closes it
 * again by itself, and opening a tab closes the others. The open tab's Close
 * is part of the tab, so pressing it closes the panel as the tab does. A tab
 * with an address is a link, which is its one keyboard stop. The resize
 * separator is a picture of its grip, and the sheet's grab is a native switch
 * whose check a stylesheet can read.
 */

import type { CSSProperties } from "react";

import { WorkspaceIcon } from "../icons/icons.js";

import type { InspectorTab } from "./inspector.js";

/** The number of tabs, which sets the columns of the tab row. */
type TabCount = CSSProperties & { "--inspector-tabs": number };

/** The column of one tab in the tab row, counted from one. */
type TabColumn = CSSProperties & { "--inspector-tab": number };

/** A tab's face: its glyph, or a link around it, then the picture of Close. */
function TabFace({ tab }: { tab: InspectorTab }) {
  return (
    <>
      {tab.href === undefined ? (
        <WorkspaceIcon name={tab.id} />
      ) : (
        <a
          aria-label={tab.title}
          className="mbk-inspector-link mbk-reset"
          href={tab.href}
        >
          <WorkspaceIcon name={tab.id} />
        </a>
      )}
      <span
        aria-hidden="true"
        className="mbk-icon-button mbk-reset"
        data-inspector-close=""
        title="Close inspector"
      >
        <WorkspaceIcon name="close" />
      </span>
    </>
  );
}

export function InspectorDisclosures({
  active,
  contentId,
  expanded,
  open,
  tabs,
}: {
  /** The tab that starts open while the inspector is open. */
  active: string | undefined;
  /** The name of the tabs' group, unique in the document. */
  contentId: string;
  /** Whether the sheet starts expanded, which checks its grab. */
  expanded: boolean;
  open: boolean;
  tabs: readonly InspectorTab[];
}) {
  const count: TabCount = { "--inspector-tabs": tabs.length };
  return (
    <section
      aria-label="Inspector"
      className="mbk-inspector mbk-reset"
      data-inspector-disclosures=""
      data-workspace-inspector=""
      style={count}
    >
      <div
        aria-hidden="true"
        className="mbk-inspector-resize mbk-reset"
        data-inspector-resize=""
      />
      <label
        className="mbk-sheet-grab mbk-reset"
        data-inspector-size=""
        title="Expand or collapse inspector"
      >
        <input
          aria-label="Expanded inspector"
          className="mbk-reset"
          defaultChecked={expanded}
          role="switch"
          type="checkbox"
        />
        <span className="mbk-reset" />
      </label>
      {tabs.map((tab, index) => {
        const column: TabColumn = { "--inspector-tab": index + 1 };
        return (
          <details
            className="mbk-reset"
            data-inspector-tab={tab.id}
            key={tab.id}
            name={contentId}
            open={open && active === tab.id}
            style={column}
          >
            <summary
              className="mbk-icon-button mbk-reset"
              id={tab.tabId}
              title={tab.title}
              {...(tab.href === undefined
                ? { "aria-label": tab.title, role: "button" }
                : { tabIndex: -1 })}
            >
              <TabFace tab={tab} />
            </summary>
            <span
              className="mbk-inspector-title mbk-reset"
              data-inspector-title=""
            >
              {tab.title}
            </span>
            <div
              className="mbk-inspector-content mbk-reset"
              data-mokly-scroll="inspector"
            >
              <section
                aria-label={tab.title}
                className="mbk-reset"
                data-inspector-panel={tab.id}
                id={tab.panelId}
              >
                {tab.panel}
              </section>
            </div>
          </details>
        );
      })}
    </section>
  );
}
