/**
 * The comparison facts in an entry's Details, in the designs' order: the
 * heading and the branch point, the path of a moved entry's earlier side, one
 * sentence for each reason, the saved variant and whether its saved props
 * stayed the same, the changed and excluded stylesheets, the paired
 * prop values, the changed components that the entry uses, the ignored
 * content, the shared-component sentence, the changed saved props, and the
 * line of an entry without changes. The host words every sentence that it
 * derives from the catalogue.
 */

import { Fragment } from "react";

import { MetadataCode, MetadataRow } from "../metadata-row/metadata-row.js";
import type { DataAttribute } from "../segmented-control/segmented-control.js";

import {
  ComparisonHeading,
  StylesheetDetails,
  type EvidenceExclusions,
  type EvidenceFiles,
} from "./evidence-files.js";

export type {
  EvidenceExclusions,
  EvidenceFiles,
  EvidenceOutcome,
  EvidenceStylesheet,
} from "./evidence-files.js";

/** A prop value of one component instance before and after the change. */
export interface EvidenceInputChange {
  /** The pair's stable key. */
  key: string;
  /** The title of the instance's component. */
  title: string;
  instanceId: string;
  viewport: string;
  colorScheme: string;
  /** The props before the change, as text. */
  before: string;
  /** The current props, as text. */
  after: string;
}

/** A link to a catalogue entry, such as a changed component. */
export interface EvidenceLink {
  href: string;
  key: string;
  title: string;
}

/** One reason's sentence, with its stable key. */
export interface EvidenceReason {
  key: string;
  text: string;
}

export function ComparisonEvidence({
  base,
  changedComponents = [],
  excluded,
  files,
  hidden,
  ignored = [],
  inputChanges = [],
  mark,
  noChanges,
  previousPath,
  reasons = [],
  savedProps,
  savedVariant,
  sharedImpact,
}: {
  /** The name of the branch point, or empty when it is not known. */
  base: string;
  /** The changed components that the entry uses. */
  changedComponents?: readonly EvidenceLink[] | undefined;
  excluded?: EvidenceExclusions | undefined;
  files?: EvidenceFiles | undefined;
  /** Hides the section, which then holds nothing, until facts are known. */
  hidden?: boolean | undefined;
  /** The ids of the content that the comparison ignored. */
  ignored?: readonly string[] | undefined;
  inputChanges?: readonly EvidenceInputChange[] | undefined;
  /** The empty data attribute that names the section, such as `data-page-evidence`. */
  mark: DataAttribute;
  /** The line of an entry without changes. */
  noChanges?: string | undefined;
  /** The path of a moved entry's earlier side. */
  previousPath?: string | undefined;
  reasons?: readonly EvidenceReason[] | undefined;
  /** The saved props before and after the change, as text, when they changed. */
  savedProps?: { after: string; before: string } | undefined;
  /**
   * The saved variant that the evidence describes: its title, and whether a
   * loaded comparison found its saved props unchanged.
   */
  savedVariant?: { savedPropsUnchanged: boolean; title: string } | undefined;
  /** The sentence of an entry that only changed components affect. */
  sharedImpact?: string | undefined;
}) {
  return (
    <section
      className="mbk-comparison-evidence"
      {...{ [mark]: "" }}
      hidden={hidden}
    >
      {!hidden ? (
        <>
          <ComparisonHeading base={base} />
          {/* String expressions keep the text nodes that Prettier would join. */}
          {previousPath ? (
            <p>
              {"The previous version is at"}{" "}
              <MetadataCode>{previousPath}</MetadataCode>
              {", where it was before the move."}
            </p>
          ) : null}
          {reasons.map((reason) => (
            <p key={reason.key}>{reason.text}</p>
          ))}
          {savedVariant ? (
            <dl className="mbk-props">
              <MetadataRow label="Saved variant" presentation="props">
                {savedVariant.title}
              </MetadataRow>
              {savedVariant.savedPropsUnchanged ? (
                <MetadataRow label="Saved props" presentation="props">
                  Unchanged
                </MetadataRow>
              ) : null}
            </dl>
          ) : null}
          <StylesheetDetails excluded={excluded} files={files} />
          {inputChanges.map((change) => (
            <Fragment key={change.key}>
              <h3>
                {change.title} · {change.instanceId} · {change.viewport}
                {" ·"} {change.colorScheme}
              </h3>
              <p>Before</p>
              <pre>{change.before}</pre>
              <p>Current</p>
              <pre>{change.after}</pre>
            </Fragment>
          ))}
          {changedComponents.map((component) => (
            <p key={component.key}>
              {"Changed component:"}{" "}
              <a href={component.href}>{component.title}</a>
            </p>
          ))}
          {ignored.length ? (
            <p>Excluded content: {ignored.join(", ")}.</p>
          ) : null}
          {sharedImpact ? <p>{sharedImpact}</p> : null}
          {savedProps ? (
            <>
              <h3>Saved props changed</h3>
              <p>Before</p>
              <pre>{savedProps.before}</pre>
              <p>Current</p>
              <pre>{savedProps.after}</pre>
            </>
          ) : null}
          {noChanges ? <p>{noChanges}</p> : null}
        </>
      ) : null}
    </section>
  );
}
