import type { ComponentProps } from "react";

import type {
  ComparisonEvidence,
  EvidenceExclusions,
  EvidenceFiles,
  EvidenceOutcome,
} from "../../../../../../../packages/ui/src/comparison-evidence/comparison-evidence.js";
import {
  COMPONENT_STYLE_COPY,
  PAGE_STYLE_COPY,
  SCREEN_STYLE_COPY,
} from "../../../parts/stylesheet_evidence.js";

/*
 * The comparison evidence of each depicted branch, in the copy that the CSS
 * evidence contract fixes. These are authored records of the files and the
 * styles that each branch changed, not an analysis of rendered pixels.
 */

/** The facts that the shipped evidence lists after its heading. */
export type EvidenceFacts = Pick<
  ComponentProps<typeof ComparisonEvidence>,
  "excluded" | "files" | "ignored" | "noChanges"
>;

/** The configured stylesheet that the example's screens link. */
const SCREEN_STYLES = "generated/styles.css";

/**
 * The other stylesheet that the styles branch changed: none of its changed
 * styles apply to Welcome or to Details.
 */
const EXCLUDED_SHEET: EvidenceExclusions = {
  paths: ["generated/excluded.css"],
  sentence: SCREEN_STYLE_COPY.excluded,
};

/**
 * The content of Welcome that the example excludes from comparisons, its
 * navigation. The comparison details of a Welcome that differs name it.
 */
const WELCOME_EXCLUDED_CONTENT = ["example-nav"];

/** The changed files of a screen: the configured stylesheet and its outcomes. */
function screenFiles(outcomes: readonly EvidenceOutcome[]): EvidenceFiles {
  return {
    lead: SCREEN_STYLE_COPY.files,
    stylesheets: [{ path: SCREEN_STYLES, outcomes }],
  };
}

/**
 * The styles branch, as Welcome's comparison details read it in Changes and
 * in All alike: the changed stylesheet with the changed styles that apply to
 * Welcome, then the other changed stylesheet, examined and excluded, then
 * Welcome's excluded content.
 */
export const MATCHED_STYLES: EvidenceFacts = {
  files: screenFiles([
    { lead: SCREEN_STYLE_COPY.matched, selectors: [".example-head", "main a"] },
  ]),
  excluded: EXCLUDED_SHEET,
  ignored: WELCOME_EXCLUDED_CONTENT,
};

/**
 * A changed style that can apply anywhere on Welcome, with its style name,
 * then Welcome's excluded content.
 */
export const UNRESOLVED_STYLES: EvidenceFacts = {
  files: screenFiles([
    { lead: SCREEN_STYLE_COPY.unresolved, selectors: [":root"] },
  ]),
  ignored: WELCOME_EXCLUDED_CONTENT,
};

/** The same reach without a style name to list. */
export const UNNAMED_STYLES: EvidenceFacts = {
  files: screenFiles([{ lead: SCREEN_STYLE_COPY.unnamed, selectors: [] }]),
  ignored: WELCOME_EXCLUDED_CONTENT,
};

/**
 * Details on the styles branch links only the excluded stylesheet, so its
 * evidence names that stylesheet and ends with the line of a screen without
 * changes.
 */
export const EXCLUDED_ONLY_STYLES: EvidenceFacts = {
  excluded: EXCLUDED_SHEET,
  noChanges: SCREEN_STYLE_COPY.noChanges,
};

/**
 * The Action on the branch that changed its own stylesheet, none of whose
 * changed styles apply to it, in the words of a variant.
 */
export const ACTION_EXCLUDED_STYLES: EvidenceFacts = {
  excluded: {
    paths: ["styles/actions.css"],
    sentence: COMPONENT_STYLE_COPY.excluded,
  },
  noChanges: COMPONENT_STYLE_COPY.noChanges,
};

/**
 * The handbook's stylesheets on the handbook branch. The shared `.action`
 * rule also changed the Action, so its match on the page reads as outside
 * the changed components; the handbook's own stylesheet changed no
 * component, and also has a change that can apply anywhere on the page.
 */
export const PAGE_FILES: EvidenceFiles = {
  lead: PAGE_STYLE_COPY.files,
  stylesheets: [
    {
      path: "styles/actions.css",
      outcomes: [{ lead: PAGE_STYLE_COPY.outside, selectors: [".action"] }],
    },
    {
      path: "styles/handbook.css",
      outcomes: [
        { lead: PAGE_STYLE_COPY.matched, selectors: ["article h2"] },
        { lead: PAGE_STYLE_COPY.unresolved, selectors: [":root"] },
      ],
    },
  ],
};

/**
 * Welcome on the excluded content branch: the content that the comparison
 * left out, Welcome's navigation, then the line of a screen without changes.
 */
export const IGNORED_CONTENT: EvidenceFacts = {
  ignored: WELCOME_EXCLUDED_CONTENT,
  noChanges: SCREEN_STYLE_COPY.noChanges,
};
