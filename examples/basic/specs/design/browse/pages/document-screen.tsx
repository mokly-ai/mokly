import { defineScreen } from "@mokly/mokly";

import { DetailsBody } from "../../../../../../packages/ui/src/details-panel/details-panel.js";
import { MetadataCode } from "../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { designMetadata } from "../../metadata.js";
import { artboards } from "../../parts/artboards.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { DetailsPanel } from "../../parts/details.js";
import { ENTRY_PATHS } from "../../parts/entry_paths.js";
import { MarkdownStage } from "../../parts/markdown.js";
import { MetaRow } from "../../parts/metadata_row.js";
import { NavTree } from "../../parts/nav.js";
import { ScreenHead, Shell, type ArtboardViewport } from "../../parts/shell.js";
import { PaymentTerms } from "../../parts/spec_documents.js";

/** A document's Details: its description and the Markdown file it renders. */
function DocumentDetails() {
  return (
    <DetailsPanel open>
      <DetailsBody description="When an invoice is due, and what happens once it is late.">
        <MetaRow name="source" label="Source">
          <MetadataCode>specs/account/billing/payment-terms.md</MetadataCode>
        </MetaRow>
      </DetailsBody>
    </DetailsPanel>
  );
}

/**
 * A Markdown document in the catalogue. Neither of its folders has a page of
 * its own, so both crumbs expand their folder in the navigation rather than
 * open anything, and the stage carries no viewport, scheme, or comparison
 * control.
 */
function DocumentView({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.document}
      viewport={viewport}
      nav={<NavTree activeDestination={DESTINATIONS.document} />}
    >
      <ScreenHead
        comparisons={false}
        crumbs={["Account", "Billing & Payments"]}
        path={ENTRY_PATHS.paymentTerms}
        title="Payment terms"
      />
      <MarkdownStage>
        <PaymentTerms />
      </MarkdownStage>
      <DocumentDetails />
    </Shell>
  );
}

export const documentScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A Markdown document in the catalogue, rendered in the shell's own typography with its breadcrumbs and Details.",
  ...artboards({
    desktop: <DocumentView viewport="desktop" />,
    mobile: <DocumentView viewport="mobile" />,
  }),
  slug: "document",
  rationale:
    "A written spec sits beside the screens it describes, so it reads in the catalogue's own type and keeps the same breadcrumbs, path, and Details as every other entry.",
  title: "Markdown document",
});
