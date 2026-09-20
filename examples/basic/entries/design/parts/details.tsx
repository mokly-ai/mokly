import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { useDesignInstance } from "../library/composition.js";
import { inspector } from "../library/inspector/inspector.js";

import { DESTINATIONS, type DesignDestination } from "./destinations.js";
import { FlowIcon } from "./icons.js";
import { MetaRow } from "./metadata_row.js";
import { SUBJECTS, type ScreenSubject } from "./subjects.js";
import { TagChips } from "./tag_filter.js";

function DetailsBody({
  activeTag,
  changedViews,
  subject,
}: {
  activeTag?: string | undefined;
  changedViews?: string | undefined;
  subject: ScreenSubject;
}) {
  const metadata = SUBJECTS[subject];
  return (
    <div className="mbk-details-body">
      <div>
        <p className="mbk-details-desc">{metadata.description}</p>
        <p className="mbk-details-rationale">
          <span className="k">Why this screen — </span>
          {metadata.rationale}
        </p>
      </div>
      <div className="mbk-meta">
        <MetaRow name="source" label="Source">
          <code className="mbk-code">{metadata.source}</code>
        </MetaRow>
        <MetaRow name="generated" label="Generated">
          <code className="mbk-code">{metadata.generated}</code>
        </MetaRow>
        <MetaRow name="schemes" label="Schemes">
          {metadata.schemes}
        </MetaRow>
        {changedViews ? (
          <MetaRow name="changed-views" label="Changed views">
            {changedViews}
          </MetaRow>
        ) : null}
        <MetaRow name="tags" label="Tags">
          <TagChips activeTag={activeTag} tags={metadata.tags} />
        </MetaRow>
        {metadata.docs ? (
          <MetaRow name="related-docs" label="Related docs">
            <span className="mbk-meta-link">Example notes</span>
          </MetaRow>
        ) : null}
        {metadata.tour ? (
          <MetaRow name="used-by" label="Used by">
            <span className="mbk-chips">
              <MockLink to={DESTINATIONS.tour} className="mbk-chip flow">
                <FlowIcon size={11} />
                Example tour
              </MockLink>
            </span>
          </MetaRow>
        ) : null}
      </div>
    </div>
  );
}

type DetailsPanelProps = {
  destination?: DesignDestination | undefined;
  /** Tag drawn as the selected chip because it is the current search term. */
  activeTag?: string | undefined;
  /** Views whose render changed, listed when the change misses the shown one. */
  changedViews?: string | undefined;
  open?: boolean;
  comparisonEvidence?: ReactNode;
} & (
  | { subject: ScreenSubject; children?: never }
  | { subject?: never; children: ReactNode }
);

/** Existing screen metadata in the shared icon inspector. */
export function DetailsPanel({
  destination,
  activeTag,
  changedViews,
  children,
  comparisonEvidence,
  open,
  subject,
}: DetailsPanelProps) {
  const evidence = comparisonEvidence !== undefined;
  const info =
    subject === undefined ? (
      children
    ) : (
      <>
        <DetailsBody
          activeTag={activeTag}
          changedViews={changedViews}
          subject={subject}
        />
        {evidence ? (
          <section
            className="mbk-comparison-details"
            aria-label="Comparison details"
          >
            <h3>Comparison details</h3>
            <p>Compared with the branch point on origin/main.</p>
            {comparisonEvidence}
          </section>
        ) : null}
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
