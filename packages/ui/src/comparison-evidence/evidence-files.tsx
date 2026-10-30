/**
 * The parts of the comparison evidence that a workspace and a whole-document
 * page share: the heading with the branch point, and each changed file with
 * its outcomes, then the stylesheets that were examined and excluded.
 */

import { Fragment } from "react";

import { MetadataCode } from "../metadata-row/metadata-row.js";

/** One outcome sentence under a changed file, with the selectors it names. */
export interface EvidenceOutcome {
  lead: string;
  selectors: readonly string[];
}

/** A changed file, named once, with every outcome that its evidence supports. */
export interface EvidenceStylesheet {
  path: string;
  outcomes: readonly EvidenceOutcome[];
}

/** The changed files and the sentence that leads them. */
export interface EvidenceFiles {
  lead: string;
  stylesheets: readonly EvidenceStylesheet[];
}

/** The stylesheets that were examined and excluded, and the sentence that says so. */
export interface EvidenceExclusions {
  paths: readonly string[];
  sentence: string;
}

/**
 * The heading of every comparison in Details, then its branch point when the
 * name is known. An empty or blank name leaves only the heading.
 */
export function ComparisonHeading({ base }: { base: string }) {
  return (
    <>
      <h3 className="mbk-reset">Comparison details</h3>
      {base.trim() ? (
        <p className="mbk-reset">Compared with the branch point on {base}.</p>
      ) : null}
    </>
  );
}

/**
 * Each changed file once, with its outcome sentences and selector lists
 * nested in its own item, so that no list mixes two stylesheets.
 */
function FileList({ lead, stylesheets }: EvidenceFiles) {
  return (
    <>
      <p className="mbk-reset">{lead}</p>
      <ul className="mbk-evidence-files mbk-reset">
        {stylesheets.map((stylesheet) => (
          <li className="mbk-reset" key={stylesheet.path}>
            {stylesheet.path}
            {stylesheet.outcomes.map((outcome) => (
              <Fragment key={outcome.lead}>
                <p className="mbk-reset">{outcome.lead}</p>
                {outcome.selectors.length ? (
                  <ul className="mbk-reset">
                    {outcome.selectors.map((selector) => (
                      <li className="mbk-reset" key={selector}>
                        <MetadataCode>{selector}</MetadataCode>
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

/** The changed files, then the stylesheets that were examined and excluded. */
export function StylesheetDetails({
  excluded,
  files,
}: {
  excluded: EvidenceExclusions | undefined;
  files: EvidenceFiles | undefined;
}) {
  return (
    <>
      {files?.stylesheets.length ? (
        <FileList lead={files.lead} stylesheets={files.stylesheets} />
      ) : null}
      {excluded?.paths.length ? (
        <>
          <p className="mbk-reset">{excluded.sentence}</p>
          <p className="mbk-reset">Examined and excluded:</p>
          <ul className="mbk-reset">
            {excluded.paths.map((path) => (
              <li className="mbk-reset" key={path}>
                {path}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
