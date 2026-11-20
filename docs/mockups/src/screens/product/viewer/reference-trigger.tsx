import { Action } from "../page-parts";

import { compactLabel } from "./published-bar";
import type { SlotBar } from "./published-bar";

/** The drawing of the open switcher, which every reference trigger opens. */
export const switcherPath = "product/viewer/switcher";

/**
 * The branch or pull request trigger of one bar composition, which the
 * fallback and the published drawings share. It is the quiet registered
 * Button inside the publication pill, whose rounded frame is the control the
 * reader sees. The full bar names the whole reference and the compact bar its
 * compact name. Both keep the label on one line in the cloud-owned reference
 * wrapper, which truncates it when the bar runs out of room, and the whole
 * reference stays the control's accessible name and its tooltip. The full
 * pill draws its chevron at its own end, after the publication's state, and
 * the compact trigger carries the chevron itself. A desktop drawing draws one
 * trigger for each composition, so each composition keeps its own instance
 * key.
 */
export function ReferenceTrigger({
  bar,
  reference,
  to,
}: {
  bar: SlotBar;
  /** The branch, or the pull request's number and title. */
  reference: string;
  /** The catalogue entry the trigger opens. A published slot opens none. */
  to?: string;
}) {
  return (
    <span
      className={
        bar.part === undefined
          ? "fo-top-reference"
          : "fo-top-reference " + bar.part
      }
      title={reference}
    >
      <Action
        instance={
          bar.compact ? "viewer-publication-compact" : "viewer-publication"
        }
        label={bar.compact ? compactLabel(reference) : reference}
        whole={reference}
        tone="quiet"
        size="sm"
        chevron={bar.compact}
        block
        singleLine
        to={to}
      />
    </span>
  );
}
