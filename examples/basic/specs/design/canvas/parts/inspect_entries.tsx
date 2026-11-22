import { mockLink } from "@mokly/mokly";

import {
  EntryChip,
  MetadataChips,
  MetadataCode,
} from "../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { NoPropsPanel } from "../../components/controls/parts/limits.js";
import { PREVIOUS_PATHS } from "../../parts/entry_paths.js";
import { MetaRow } from "../../parts/metadata_row.js";
import { SUBJECTS, type ScreenSubject } from "../../parts/subjects.js";
import { TagChips } from "../../parts/tag_filter.js";
import type { CatalogueTag } from "../../parts/tags.js";

import { CANVAS_PAGES } from "./destinations.js";
import { CANVAS_ENTRIES } from "./entries.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectRationale,
  InspectSelection,
  WrappingPath,
} from "./inspect.js";
import { NoComponents, ScreenUsage } from "./inspect_folds.js";
import { InspectVariants } from "./inspect_variants.js";

/**
 * The Details rows of today's inspector that a depicted screen has, after
 * its path and source. A related doc that no Canvas artboard shows is named
 * as text, because Canvas links stay inside the Canvas family. The use case
 * in Used by opens its Canvas artboard. The chip of the tag that the search
 * enters reads active.
 */
export function SubjectRows({
  activeTag,
  subject,
}: {
  activeTag?: CatalogueTag | undefined;
  subject: ScreenSubject;
}) {
  const metadata = SUBJECTS[subject];
  return (
    <>
      {metadata.previousPath ? (
        <MetaRow name="moved-from" label="Moved from">
          <MetadataCode>
            <WrappingPath path={metadata.previousPath} />
          </MetadataCode>
        </MetaRow>
      ) : null}
      <MetaRow name="schemes" label="Schemes">
        {metadata.schemes}
      </MetaRow>
      {metadata.tags.length > 0 ? (
        <MetaRow name="tags" label="Tags">
          <TagChips activeTag={activeTag} tags={metadata.tags} />
        </MetaRow>
      ) : null}
      {metadata.relatedDocs ? (
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
              href={mockLink(CANVAS_PAGES.useCase)}
              kind="use-case"
              title="Example tour"
            />
          </MetadataChips>
        </MetaRow>
      ) : null}
    </>
  );
}

/**
 * Inspect for Profile: unmodified, light only, and rendering no registered
 * component, so Highlight components is unavailable.
 */
export function ProfileInspect() {
  const subject = SUBJECTS.profile;
  return (
    <>
      <InspectHead
        description={subject.description}
        entry={CANVAS_ENTRIES.profile}
        rows={<SubjectRows subject="profile" />}
        source={subject.source}
      />
      <InspectRationale noun="screen" text={subject.rationale} />
      <InspectVariants
        variants={[
          { label: "Profile", current: true },
          { label: "Unverified email" },
        ]}
      />
      <InspectFrames
        count={2}
        filter={{
          viewports: true,
          mobile: true,
          desktop: true,
          light: true,
          dark: false,
          lightOnly: true,
          highlight: false,
          unavailable: "empty",
        }}
      />
      <InspectSelection />
      <InspectFold name="props" title="Props">
        <NoPropsPanel />
      </InspectFold>
      <InspectFold name="usage" title="Usage">
        <ScreenUsage />
      </InspectFold>
      <InspectFold count={0} name="components" title="Components">
        <NoComponents />
      </InspectFold>
    </>
  );
}

/** Inspect for the Payment terms document, which moved under Account. */
export function PaymentTermsInspect() {
  return (
    <InspectHead
      description="When an invoice is due, and what happens once it is late."
      entry={CANVAS_ENTRIES.paymentTerms}
      rows={
        <MetaRow name="moved-from" label="Moved from">
          <MetadataCode>
            <WrappingPath path={PREVIOUS_PATHS.paymentTerms} />
          </MetadataCode>
        </MetaRow>
      }
      source="specs/account/billing/payment-terms.md"
    />
  );
}
