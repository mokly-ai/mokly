/**
 * The comparison details that a workspace and a whole-document page share:
 * each changed file with its outcome sentences, and the stylesheets that every
 * supplied record examined and excluded, as the records and the wording that
 * `@mokly/ui/comparison-evidence` draws.
 */

import type {
  EvidenceExclusions,
  EvidenceFiles,
} from "@mokly/ui/comparison-evidence";

import type { ChangeReason, EvidenceReasons } from "../review/types.js";

import { entryWording } from "./entry_wording.js";
import {
  excludedStylesheets,
  retainedPaths,
} from "./workspace_style_evidence.js";
import {
  stylesheetEvidence,
  type EvidenceSubject,
} from "./workspace_stylesheet_evidence.js";

/** The changed files and the excluded stylesheets of one entry's Details. */
export interface StylesheetDetails {
  excluded?: EvidenceExclusions;
  files?: EvidenceFiles;
}

/**
 * Each changed file once with its outcomes, then the stylesheets that every
 * supplied record examined and excluded. The subject selects only the wording
 * and, for a component, which rules keep the component's own sentence.
 */
export function stylesheetDetails(
  reasons: readonly ChangeReason[],
  resources: readonly EvidenceReasons[],
  subject: EvidenceSubject,
): StylesheetDetails {
  const wording = entryWording(subject.kind);
  const stylesheets = stylesheetEvidence(reasons, subject);
  const excluded = excludedStylesheets(resources, retainedPaths(reasons));
  return {
    ...(stylesheets.length
      ? { files: { lead: wording.filesLead, stylesheets } }
      : {}),
    ...(excluded.length
      ? {
          excluded: {
            paths: excluded,
            sentence:
              excluded.length === 1
                ? wording.excludedStylesheet
                : wording.excludedStylesheets,
          },
        }
      : {}),
  };
}
