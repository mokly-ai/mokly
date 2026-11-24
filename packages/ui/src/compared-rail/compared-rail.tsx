/**
 * Compared: the two versions that the Changes tab compares, as two dots on a
 * rail. Before is the branch point on the base, and Current is this branch,
 * whose dot is in the signal colour. An entry that the branch added has no
 * version before, and an entry that the branch removed has no current
 * version, so each shows its one version and a line that says why. The panel
 * that holds the rail gives it its heading.
 */

import type { ReactNode } from "react";

/** Why the rail holds one version: the branch added or removed the entry. */
export type ComparedOutcome = "added" | "removed";

/** The line under a rail that holds one version. */
const OUTCOME_NOTES: Record<ComparedOutcome, string> = {
  added: "Added on this branch, so there is no base to compare.",
  removed: "Removed on this branch, so there is no current version to compare.",
};

/** One version on the rail: its dot, its side, and its name. */
function Version({
  children,
  side,
}: {
  children: ReactNode;
  side: "before" | "current";
}) {
  return (
    <li className="mbk-compared-version mbk-reset" data-compared-side={side}>
      <span aria-hidden="true" className="mbk-compared-dot mbk-reset" />
      <span className="mbk-compared-side mbk-reset">
        {side === "before" ? "Before" : "Current"}
      </span>{" "}
      <span className="mbk-compared-name mbk-reset">{children}</span>
    </li>
  );
}

export function ComparedRail({
  base,
  outcome,
}: {
  /** The base's name, such as `origin/main`; empty when the catalogue names none. */
  base: string;
  /** `added`: the current version alone. `removed`: the version before alone. */
  outcome?: ComparedOutcome | undefined;
}) {
  return (
    <div className="mbk-compared mbk-reset">
      <ol
        className="mbk-compared-rail mbk-reset"
        data-compared-outcome={outcome}
      >
        {outcome === "added" ? null : (
          <Version side="before">
            {base.trim() ? (
              <>
                Branch point on <code className="mbk-reset">{base}</code>
              </>
            ) : (
              "Branch point"
            )}
          </Version>
        )}
        {outcome === "removed" ? null : (
          <Version side="current">This branch</Version>
        )}
      </ol>
      {outcome === undefined ? null : (
        <p className="mbk-compared-note mbk-reset">{OUTCOME_NOTES[outcome]}</p>
      )}
    </div>
  );
}
