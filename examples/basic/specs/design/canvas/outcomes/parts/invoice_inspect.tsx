import { mockLink } from "@mokly/mokly";

import {
  MetadataChips,
  MetadataCode,
  MetadataLink,
} from "../../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { NoPropsPanel } from "../../../components/controls/parts/limits.js";
import type { FramesFilterProps } from "../../../library/inspector/frames-filter.js";
import { MetaRow } from "../../../parts/metadata_row.js";
import { SUBJECTS } from "../../../parts/subjects.js";
import { CANVAS_PAGES } from "../../parts/destinations.js";
import { CANVAS_ENTRIES } from "../../parts/entries.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectRationale,
  InspectSelection,
  WrappingPath,
} from "../../parts/inspect.js";
import { NoComponents, ScreenUsage } from "../../parts/inspect_folds.js";
import { InspectVariants } from "../../parts/inspect_variants.js";

import { INVOICE } from "./invoice.js";

/**
 * Invoice's Frames filter: it renders in Light only, so the Dark toggle
 * reads Light only, and it renders no registered component, so Highlight
 * components is unavailable.
 */
const LIGHT_ONLY_FRAMES = {
  viewports: true,
  mobile: true,
  desktop: true,
  light: true,
  dark: false,
  lightOnly: true,
  highlight: false,
  unavailable: "empty",
} as const satisfies FramesFilterProps;

/**
 * Invoice's Details rows after its path and source: the path that it moved
 * from, its one scheme, and the related Payment terms document, which opens
 * its reading frame. Invoice declares no tags.
 */
function InvoiceRows() {
  const subject = SUBJECTS.invoice;
  return (
    <>
      {subject.previousPath ? (
        <MetaRow name="moved-from" label="Moved from">
          <MetadataCode>
            <WrappingPath path={subject.previousPath} />
          </MetadataCode>
        </MetaRow>
      ) : null}
      <MetaRow name="schemes" label="Schemes">
        {subject.schemes}
      </MetaRow>
      <MetaRow name="related-docs" label="Related docs">
        <MetadataChips>
          <MetadataLink href={mockLink(CANVAS_PAGES.document)}>
            {CANVAS_ENTRIES.paymentTerms.title}
          </MetadataLink>
        </MetadataChips>
      </MetaRow>
    </>
  );
}

/**
 * Inspect for the moved Invoice: its head with the Moved from row, its
 * rationale, its Overdue variant, its two Light frames, and the folded
 * sections of a screen with no props that renders no registered component.
 */
export function InvoiceInspect() {
  const subject = SUBJECTS.invoice;
  return (
    <>
      <InspectHead
        description={subject.description}
        entry={INVOICE}
        rows={<InvoiceRows />}
        source={subject.source}
      />
      <InspectRationale noun="screen" text={subject.rationale} />
      <InspectVariants
        variants={[{ label: "Invoice", current: true }, { label: "Overdue" }]}
      />
      <InspectFrames count={2} filter={LIGHT_ONLY_FRAMES} />
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
