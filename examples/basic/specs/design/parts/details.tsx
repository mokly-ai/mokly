import type { ComponentProps, ReactNode } from "react";

import { mockLink } from "@mokly/mokly";

import { ComparisonEvidence } from "../../../../../packages/ui/src/comparison-evidence/comparison-evidence.js";
import { DetailsBody as DetailsBodyView } from "../../../../../packages/ui/src/details-panel/details-panel.js";
import {
  EntryChip,
  MetadataChips,
  MetadataCode,
  MetadataLink,
} from "../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { useDesignInstance } from "../library/composition.js";
import { inspector } from "../library/inspector/inspector.js";

import { DESTINATIONS, type DesignDestination } from "./destinations.js";
import { MetaRow } from "./metadata_row.js";
import { SUBJECTS, type ScreenSubject } from "./subjects.js";
import { TagChips } from "./tag_filter.js";

/** A depicted entry's description and its metadata rows in the shipped body. */
function DetailsBody({
  activeTag,
  changedViews,
  subject,
}: {
  activeTag?: string | undefined;
  changedViews?: ReactNode;
  subject: ScreenSubject;
}) {
  const metadata = SUBJECTS[subject];
  return (
    <DetailsBodyView
      description={metadata.description}
      rationale={{ noun: "screen", text: metadata.rationale }}
    >
      <MetaRow name="source" label="Source">
        <MetadataCode>{metadata.source}</MetadataCode>
      </MetaRow>
      {metadata.previousPath ? (
        <MetaRow name="moved-from" label="Moved from">
          <MetadataCode>{metadata.previousPath}</MetadataCode>
        </MetaRow>
      ) : null}
      <MetaRow name="schemes" label="Schemes">
        {metadata.schemes}
      </MetaRow>
      {changedViews ? (
        <MetaRow name="changed-views" label="Changed views">
          {changedViews}
        </MetaRow>
      ) : null}
      {metadata.tags.length > 0 ? (
        <MetaRow name="tags" label="Tags">
          <TagChips activeTag={activeTag} tags={metadata.tags} />
        </MetaRow>
      ) : null}
      {metadata.relatedDocument ? (
        <MetaRow name="related-docs" label="Related docs">
          <MetadataChips>
            <MetadataLink href={mockLink(metadata.relatedDocument.to)}>
              {metadata.relatedDocument.title}
            </MetadataLink>
          </MetadataChips>
        </MetaRow>
      ) : metadata.relatedDocs ? (
        <MetaRow name="related-docs" label="Related docs">
          <MetadataChips>
            <MetadataCode>Example notes</MetadataCode>
          </MetadataChips>
        </MetaRow>
      ) : null}
      {metadata.tour ? (
        <MetaRow name="used-by" label="Used by">
          <MetadataChips>
            <EntryChip
              href={mockLink(DESTINATIONS.tour)}
              kind="use-case"
              title="Example tour"
            />
          </MetadataChips>
        </MetaRow>
      ) : null}
    </DetailsBodyView>
  );
}

/**
 * The comparison facts of a depicted entry, which the shipped evidence draws
 * after the heading and the branch point inside the approved card.
 */
export type CardEvidence = Omit<
  ComponentProps<typeof ComparisonEvidence>,
  "base" | "hidden" | "mark"
>;

type DetailsPanelProps = {
  destination?: DesignDestination | undefined;
  /** Tag drawn as the selected chip because it is the current search term. */
  activeTag?: string | undefined;
  /** Views whose render changed, listed when the change misses the shown one. */
  changedViews?: ReactNode;
  open?: boolean;
  comparisonEvidence?: CardEvidence | undefined;
} & (
  | { subject: ScreenSubject; children?: never }
  | { subject?: never; children: ReactNode }
);

/**
 * Existing screen metadata, or an authored metadata body such as a document
 * page's, in the shared icon inspector. The shipped comparison evidence
 * follows either, in the approved bordered card.
 */
export function DetailsPanel({
  destination,
  activeTag,
  changedViews,
  children,
  comparisonEvidence,
  open,
  subject,
}: DetailsPanelProps) {
  const body =
    subject === undefined ? (
      children
    ) : (
      <DetailsBody
        activeTag={activeTag}
        changedViews={changedViews}
        subject={subject}
      />
    );
  const info =
    comparisonEvidence === undefined ? (
      body
    ) : (
      <>
        {body}
        <section
          className="mbk-comparison-details"
          aria-label="Comparison details"
        >
          <ComparisonEvidence
            base="origin/main"
            mark={
              subject === undefined
                ? "data-page-evidence"
                : "data-workspace-evidence"
            }
            {...comparisonEvidence}
          />
        </section>
      </>
    );
  return (
    <inspector.Component
      moklyInstance={useDesignInstance("inspector")}
      tabs={[
        {
          id: "info",
          label: "Details",
          ...(destination ? { destination } : {}),
        },
      ]}
      initial={open ? "info" : "closed"}
      sheetSize="compact"
      info={info}
    />
  );
}
