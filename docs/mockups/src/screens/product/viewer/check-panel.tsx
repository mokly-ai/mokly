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
 * The cloud's Mokly check in the package's Changes tab, after the change
 * stepper: one card in its own section of the tab, which says the check
 * succeeded, gives its summary, and links the pull request's checks on
 * GitHub, where the check lives. The reader is already in Changes, so the
 * card has no View Changes link, and the bar already links the pull request
 * itself. The application's card in `packages/app/src/viewer/check-card.tsx`
 * draws the same markup.
 */
export function ChangesCheck({ pull }: { pull: CheckedPullRequest }) {
  return (
    <div className="fo-canvas-check-slot">
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
    </div>
  );
}
