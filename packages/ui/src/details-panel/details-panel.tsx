/**
 * The Details of a catalogue entry: the collapsible panel below a page's
 * stage, and the two-column body that it and the inspector's Details tab
 * show, with the description and the rationale on the left and the metadata
 * rows on the right.
 */

import type { ReactNode } from "react";

import { ChevronIcon } from "../icons/icons.js";

/**
 * The collapsible Details panel: a native `<details>` element whose bar
 * names what it holds. The host holds the open state.
 */
export function DetailsPanel({
  children,
  onOpenChange,
  open,
}: {
  /** The details body, then any comparison details. */
  children?: ReactNode;
  /**
   * Receives the open state that the reader asks for with the bar. Without
   * it, the panel opens and closes natively.
   */
  onOpenChange?: ((open: boolean) => void) | undefined;
  open: boolean;
}) {
  return (
    <details
      className="mbk-details"
      data-mokly-details=""
      onToggle={(event) => {
        if (event.currentTarget.open !== open)
          onOpenChange?.(event.currentTarget.open);
      }}
      open={open}
    >
      <summary className="mbk-details-bar">
        <span className="chev">
          <ChevronIcon size={12} />
        </span>
        Details
        <span className="mbk-details-hint">
          Description, rationale, source, related docs, and use cases
        </span>
      </summary>
      {children}
    </details>
  );
}

/** Why an entry exists, and the noun that names its kind, such as "flow". */
export interface DetailsRationale {
  noun: string;
  text: string;
}

/**
 * The body of an entry's Details: its description, its rationale when it
 * has one, and the metadata rows in a column beside them.
 */
export function DetailsBody({
  children,
  description,
  rationale,
}: {
  /** The metadata rows. */
  children?: ReactNode;
  description: string;
  rationale?: DetailsRationale | undefined;
}) {
  return (
    <div className="mbk-details-body">
      <div>
        <p className="mbk-details-desc">{description}</p>
        {rationale ? (
          <p className="mbk-details-rationale">
            {/* String expressions keep four text nodes that Prettier would join. */}
            <span className="k">
              Why this {rationale.noun}
              {" —"}{" "}
            </span>
            {rationale.text}
          </p>
        ) : null}
      </div>
      <div className="mbk-meta">{children}</div>
    </div>
  );
}
