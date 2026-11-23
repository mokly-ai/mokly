/**
 * The selected PriceCard on a pricing artboard: the shared selection box
 * with the `PriceCard` name tag over the card's place, and, as each frame
 * needs it, the card's padding redline, Maya's comment pin and Claude's live
 * selection. The stylesheet places the box on the featured card of the
 * phone screen, in percent of the artboard, so one rule serves every scale.
 */

import { classNames } from "../parts/class-names.js";
import { SiteRedline, SiteSelection } from "../parts/selection.js";

/** The selected card and the marks that a frame adds to it. */
export function CardSelection({
  claude = false,
  padding,
  pin = false,
  tall = false,
}: {
  claude?: boolean | undefined;
  padding?: "16" | "24" | undefined;
  pin?: boolean | undefined;
  /** The card after the change, whose 24px padding makes it taller. */
  tall?: boolean | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "site-home-card-sel",
        tall && "site-home-card-sel--tall",
      )}
    >
      <SiteSelection handles="none" name="PriceCard" nameIcon="component" />
      {padding === undefined ? null : (
        <SiteRedline
          className={`site-home-card-pad site-home-card-pad--${padding}`}
          horizontal
          value={padding}
        />
      )}
      {/* status: "ahead" (agent sessions, Claude) */}
      {claude ? (
        <SiteSelection
          className="site-home-card-claude"
          handles="none"
          person="claude"
          tag="Claude is editing"
        />
      ) : null}
      {/* status: "ahead" (comments) */}
      {pin ? <span className="site-pin">M</span> : null}
    </span>
  );
}
