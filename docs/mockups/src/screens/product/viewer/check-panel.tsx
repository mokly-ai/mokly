import "../../../../styles/product/viewer-canvas-check.css";
import type { ViewerCatalogueScreen } from "../../../fixtures/viewer-catalogue";
import { viewerCatalogue } from "../../../fixtures/viewer-catalogue";
import { Icon } from "../icons";

import { SuccessGlyph } from "./glyphs";

/** The pull request whose publication the cloud's check reports on. */
export interface CheckedPullRequest {
  number: string;
  title: string;
  /** The pull request on GitHub, whose checks page holds the check. */
  github: string;
}

/** The kinds of change that the check counts, in its summary's order. */
const kinds = ["changed", "added", "removed"] as const;

type ChangeKind = (typeof kinds)[number];

/**
 * How the check counts one screen of the drawing's catalogue. Every screen
 * of that catalogue is current and none of them is new, and the catalogue
 * holds no removed screen, so a screen counts as changed when its drawing
 * changed and is not counted otherwise.
 */
function kindOf(screen: ViewerCatalogueScreen): ChangeKind | undefined {
  return screen.changed ? "changed" : undefined;
}

/**
 * The summary of the check that the cloud posts for a valid comparison, as
 * `changes-check.md` writes it: `{c} changed, {a} added, {r} removed.`, with
 * the counts of the drawing's catalogue.
 */
export const checkSummary =
  kinds
    .map(
      (kind) =>
        viewerCatalogue.screens.filter((screen) => kindOf(screen) === kind)
          .length +
        " " +
        kind,
    )
    .join(", ") + ".";

/**
 * The cloud's Mokly check beside the stage: a floating Canvas panel headed
 * Changes, with the check card. The card says the check succeeded, gives
 * its summary, and links the pull request's checks on GitHub, where the
 * check lives; the bar already links the pull request itself. The package
 * draws its own Changes, so this panel holds only what the cloud owns.
 *
 * Milestone 12 builds the package's Changes tab with a slot for the cloud's
 * check, and Milestone 13 then moves this card into that slot. Until then
 * the card fills the embedded layout's side panel, which a desktop drawing
 * shows where its bar is wide enough for the full composition.
 */
export function ChangesCheck({ pull }: { pull: CheckedPullRequest }) {
  return (
    <div className="fo-canvas-check-host fo-full-bar-only">
      <section
        className="fo-canvas-check-panel"
        aria-labelledby="mkc-check-heading"
      >
        <h2 className="fo-canvas-check-heading" id="mkc-check-heading">
          Changes
        </h2>
        <div className="fo-canvas-check">
          <div className="fo-canvas-check-result">
            <span className="fo-canvas-check-glyph">
              <SuccessGlyph />
            </span>
            <p className="fo-canvas-check-text">
              <span className="fo-canvas-check-name">Mokly</span>{" "}
              <span className="fo-canvas-check-summary">{checkSummary}</span>
            </p>
          </div>
          <a className="fo-canvas-check-link" href={pull.github + "/checks"}>
            <span className="fo-canvas-check-link-glyph">
              <Icon name="pullRequest" size={14} />
            </span>
            <span className="fo-canvas-check-link-label">
              {pull.number + " · " + pull.title}
            </span>
            <span className="fo-canvas-check-link-glyph">
              <Icon name="external" size={14} />
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
