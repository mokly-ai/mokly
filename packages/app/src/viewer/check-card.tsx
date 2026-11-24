import type { ReactElement } from "react";

import type { Publication, PublicationPullRequest } from "../api/types";
import { Icon } from "../components/icons";

import { SuccessGlyph } from "./glyphs";

/**
 * The Mokly check in the package's Changes tab, as the catalogue's
 * `docs/mockups/src/screens/product/viewer/check-panel.tsx` draws it: one
 * card in its own section of the tab, which says the check succeeded, gives
 * the check's totals line, and links the pull request's checks on GitHub,
 * where the check lives. The reader is already in Changes, so the card has
 * no View Changes link, and the bar already links the pull request itself.
 * The link leaves the app in the same tab, as the bar's GitHub link does;
 * the desktop shell opens it in the system browser.
 */
function ChangesCheck({
  pull,
  totals,
}: {
  pull: Pick<PublicationPullRequest, "number" | "title" | "url">;
  totals: string;
}) {
  return (
    <div className="fo-canvas-check-slot">
      <div className="fo-canvas-check">
        <div className="fo-canvas-check-result">
          <span className="fo-canvas-check-glyph">
            <SuccessGlyph />
          </span>
          <p className="fo-canvas-check-text">
            <span className="fo-canvas-check-name">Mokly</span>{" "}
            <span className="fo-canvas-check-summary">{totals}</span>
          </p>
        </div>
        <a className="fo-canvas-check-link" href={pull.url + "/checks"}>
          <span className="fo-canvas-check-link-glyph">
            <Icon name="pullRequest" size={14} />
          </span>
          <span className="fo-canvas-check-link-label">
            {"#" + pull.number + " · " + pull.title}
          </span>
          <span className="fo-canvas-check-link-glyph">
            <Icon name="external" size={14} />
          </span>
        </a>
      </div>
    </div>
  );
}

/**
 * The check card of the shown publication: the Mokly check that the cloud
 * posts for a pull request's publication with a comparison, whose result is
 * a success. Its totals line is the check's own, from the counts that
 * admission stored. A branch's publication and a publication without a
 * comparison get no card, so the Changes tab's slot takes no space. A
 * comparison without counts breaks the read model, so it gets no card either,
 * rather than counts that nobody measured.
 */
export function changesCheck(
  publication: Publication | undefined,
): ReactElement | undefined {
  const pull = publication?.pullRequest;
  const changes = publication?.changes;
  if (!pull || changes?.state !== "available") return undefined;
  const { changed, added, removed } = changes;
  if (changed === null || added === null || removed === null) return undefined;
  return (
    <ChangesCheck
      pull={pull}
      totals={`${changed} changed, ${added} added, ${removed} removed.`}
    />
  );
}
