/**
 * The right panel's tab strip: text tabs on the panel head's hairline, a tab
 * list named `Panel`. The selected tab is ink at weight 600 over a 2px signal
 * rule, and every label keeps the width of its bold form, so a change of tab
 * moves nothing. ArrowLeft and ArrowRight select the tab before and after
 * and wrap, and Home and End select the first and the last tab; focus
 * follows. The host holds the selected tab and receives each choice.
 */

import { useRef, type KeyboardEvent, type ReactNode } from "react";

/** A tab of the right panel. */
export type PanelTab = "changes" | "inspect";

/** One tab of the strip: its name and its label. */
export interface PanelTabItem {
  id: PanelTab;
  label: string;
}

/** The keys that move between the tabs. */
const KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

/** The index of the tab that a key names, from the index of the focused one. */
function keyedIndex(key: string, index: number, count: number): number {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return (index + (key === "ArrowRight" ? 1 : count - 1)) % count;
}

export function PanelTabs({
  label = "Panel",
  onSelect,
  panelId,
  selected,
  tabId,
  tabs,
}: {
  /** The tab list's accessible name. */
  label?: string;
  /** Receives each tab that the reader chooses. */
  onSelect(tab: PanelTab): void;
  /** The id of the panel that each tab controls. */
  panelId(tab: PanelTab): string;
  selected: PanelTab;
  /** The id of each tab, which names the panel through `aria-labelledby`. */
  tabId(tab: PanelTab): string;
  tabs: readonly PanelTabItem[];
}) {
  const buttons = useRef(new Map<PanelTab, HTMLButtonElement>());
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!KEYS.has(event.key)) return;
    const index = tabs.findIndex(({ id }) => id === selected);
    const next = tabs[keyedIndex(event.key, Math.max(index, 0), tabs.length)];
    if (!next) return;
    event.preventDefault();
    onSelect(next.id);
    buttons.current.get(next.id)?.focus();
  };
  return (
    <div
      aria-label={label}
      className="mbk-panel-tabs mbk-reset"
      onKeyDown={keyDown}
      role="tablist"
    >
      {tabs.map((tab) => {
        const chosen = tab.id === selected;
        return (
          <button
            aria-controls={panelId(tab.id)}
            aria-selected={chosen}
            className="mbk-panel-tab mbk-reset"
            data-panel-tab={tab.id}
            id={tabId(tab.id)}
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            ref={(element) => {
              if (element) buttons.current.set(tab.id, element);
              else buttons.current.delete(tab.id);
            }}
            role="tab"
            tabIndex={chosen ? 0 : -1}
            type="button"
          >
            <span
              className="mbk-panel-tab-label mbk-reset"
              data-text={tab.label}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The body of one tab: the tab panel that its tab names, which a host
 * scrolls with its panel. A host keeps the body of a tab that is not
 * selected mounted and hidden, so its content keeps its state.
 */
export function PanelTabBody({
  children,
  hidden = false,
  id,
  labelledBy,
}: {
  children?: ReactNode;
  /** Whether the tab is not selected, which hides its body. */
  hidden?: boolean | undefined;
  id: string;
  /** The id of the body's tab. */
  labelledBy: string;
}) {
  return (
    <div
      aria-labelledby={labelledBy}
      className="mbk-panel-tab-body mbk-reset"
      hidden={hidden}
      id={id}
      role="tabpanel"
    >
      {children}
    </div>
  );
}
