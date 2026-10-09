/** The changed-files lead and its list, in the approved per-file layout. */

import { Fragment } from "react";

import type { StylesheetEvidence } from "./workspace_stylesheet_evidence.js";

/**
 * Name every changed file once. Each file's outcome sentences and selector
 * lists sit inside its own item, so no list mixes two stylesheets.
 */
export function StylesheetEvidenceList({
  lead,
  stylesheets,
}: {
  lead: string;
  stylesheets: readonly StylesheetEvidence[];
}) {
  return (
    <>
      <p>{lead}</p>
      <ul className="mbk-evidence-files">
        {stylesheets.map((stylesheet) => (
          <li key={stylesheet.path}>
            {stylesheet.path}
            {stylesheet.outcomes.map((outcome) => (
              <Fragment key={outcome.lead}>
                <p>{outcome.lead}</p>
                {outcome.selectors.length ? (
                  <ul>
                    {outcome.selectors.map((selector) => (
                      <li key={selector}>
                        <code className="mbk-code">{selector}</code>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Fragment>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}
