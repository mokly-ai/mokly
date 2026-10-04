import { Fragment } from "react";

/** Screen copy for stylesheet evidence, as the CSS evidence contract fixes it. */
export const SCREEN_STYLE_COPY = {
  files: "Changes to these files may affect this screen:",
  matched: "Changed styles that apply to this screen:",
  outside:
    "These changed styles also apply outside the changed components on this screen:",
  unresolved:
    "This change can apply anywhere on the screen, so the screen stays in Changes:",
  unnamed:
    "This change can apply anywhere on the screen, so the screen stays in Changes.",
  excluded:
    "This stylesheet changed, but none of the changed styles apply to this screen.",
  stylesChanged: "Styles this screen uses changed",
} as const;

/** The same evidence recast for a component and its saved variants. */
export const COMPONENT_STYLE_COPY = {
  files: "Changes to these files may affect this component:",
  matched: "Changed styles that apply to this component:",
  excluded:
    "This stylesheet changed, but none of the changed styles apply to this variant.",
  stylesChanged: "Styles this variant uses changed",
} as const;

/**
 * The same evidence for a whole-document page. Mokly records no component
 * output on a page, so every match on it is outside the changed components.
 */
export const PAGE_STYLE_COPY = {
  files: "Changes to these files may affect this page:",
  matched: "Changed styles that apply to this page:",
  outside:
    "These changed styles also apply outside the changed components on this page:",
  unresolved:
    "This change can apply anywhere on the page, so the page stays in Changes:",
} as const;

/** One outcome under a stylesheet: its lead sentence and the styles it names. */
export interface StylesheetOutcome {
  lead: string;
  selectors: readonly string[];
}

/** A changed file named once, with the evidence that file retained. */
export interface StylesheetEvidence {
  path: string;
  outcomes: readonly StylesheetOutcome[];
}

/**
 * The files lead, then every changed file once. Each file's outcome sentences
 * and style lists sit under that file, so no list mixes two stylesheets.
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
