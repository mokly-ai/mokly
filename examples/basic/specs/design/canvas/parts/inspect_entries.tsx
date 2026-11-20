import {
  MetadataChips,
  MetadataCode,
} from "../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { NoPropsPanel } from "../../components/controls/parts/limits.js";
import { COMPONENTS } from "../../components/parts/metadata.js";
import { PREVIOUS_PATHS } from "../../parts/entry_paths.js";
import { MetaRow } from "../../parts/metadata_row.js";
import { SUBJECTS, type ScreenSubject } from "../../parts/subjects.js";
import { TagChips } from "../../parts/tag_filter.js";

import { CANVAS_ENTRIES } from "./entries.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectRationale,
  InspectSelection,
  InspectVariants,
  WrappingPath,
} from "./inspect.js";
import { ActionUsage, NoComponents, ScreenUsage } from "./inspect_folds.js";

/**
 * The Details rows of today's inspector that a depicted screen has, after
 * its path and source. A related entry would open a Browse artboard, and
 * Canvas links stay inside the Canvas family, so it is named as text.
 */
export function SubjectRows({ subject }: { subject: ScreenSubject }) {
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
          <TagChips tags={metadata.tags} />
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
          Example tour
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

/**
 * Inspect for the Action component, which opens as its variant set: its
 * frames are its saved variants in each scheme, so none is checked.
 */
export function ActionInspect() {
  const component = COMPONENTS.action;
  return (
    <>
      <InspectHead
        description={component.description}
        entry={CANVAS_ENTRIES.action}
        rows={
          <>
            <MetaRow name="schemes" label="Schemes">
              light, dark
            </MetaRow>
            <MetaRow name="tags" label="Tags">
              <TagChips tags={["forms"]} />
            </MetaRow>
          </>
        }
        source={component.source}
      />
      <InspectVariants
        variants={[
          { label: "Default" },
          { label: "Disabled" },
          { label: "Secondary" },
        ]}
      />
      <InspectFrames
        count={6}
        filter={{
          viewports: false,
          mobile: true,
          desktop: true,
          light: true,
          dark: true,
          highlight: false,
          unavailable: "empty",
        }}
      />
      <InspectSelection />
      <InspectFold count={6} name="props" title="Props" />
      <InspectFold count={2} name="usage" title="Usage">
        <ActionUsage />
      </InspectFold>
      <InspectFold name="components" title="Components">
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
