/**
 * Comparison details that a workspace and a whole-document page share: the
 * heading, then each changed file and the stylesheets examined and excluded.
 */

import type { EntryChangeReason } from "../review/component_types.js";
import type { ResourceEvidence } from "../review/types.js";

import { entryWording } from "./entry_wording.js";
import {
  excludedStylesheets,
  retainedPaths,
} from "./workspace_style_evidence.js";
import {
  stylesheetEvidence,
  type EvidenceSubject,
} from "./workspace_stylesheet_evidence.js";
import { StylesheetEvidenceList } from "./workspace_stylesheet_list.js";

/** The heading and the branch point that every comparison in Details names. */
export function ComparisonHeading({ base }: { base: string }) {
  return (
    <>
      <h3>Comparison details</h3>
      <p>Compared with the branch point on {base}.</p>
    </>
  );
}

/**
 * Each changed file once with its outcomes, then the stylesheets that every
 * supplied record examined and excluded. The subject selects only the wording
 * and, for a component, which rules keep the component's own sentence.
 */
export function StylesheetDetails({
  reasons,
  resources,
  subject,
}: {
  reasons: readonly EntryChangeReason[];
  resources: readonly ResourceEvidence[];
  subject: EvidenceSubject;
}) {
  const wording = entryWording(subject.kind);
  const stylesheets = stylesheetEvidence(reasons, subject);
  const excluded = excludedStylesheets(resources, retainedPaths(reasons));
  return (
    <>
      {stylesheets.length ? (
        <StylesheetEvidenceList
          lead={wording.filesLead}
          stylesheets={stylesheets}
        />
      ) : null}
      {excluded.length ? (
        <>
          <p>
            {excluded.length === 1
              ? wording.excludedStylesheet
              : wording.excludedStylesheets}
          </p>
          <p>Examined and excluded:</p>
          <ul>
            {excluded.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
