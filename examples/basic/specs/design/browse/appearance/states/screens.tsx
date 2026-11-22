import { defineScreen } from "@mokly/mokly";

import { DetailsBody } from "../../../../../../../packages/ui/src/details-panel/details-panel.js";
import { appearanceDesignMetadata } from "../../../metadata.js";
import { artboards } from "../../../parts/artboards.js";
import { DESTINATIONS } from "../../../parts/destinations.js";
import { DetailsPanel } from "../../../parts/details.js";
import { ENTRY_PATHS } from "../../../parts/entry_paths.js";
import { MarkdownStage } from "../../../parts/markdown.js";
import { MetaRow } from "../../../parts/metadata_row.js";
import { NavTree, type NavNode } from "../../../parts/nav.js";
import { PreviousVersionStage } from "../../../parts/removed_preview.js";
import { ScreenHead, type ArtboardViewport } from "../../../parts/shell.js";
import { PaymentTerms } from "../../../parts/spec_documents.js";
import { AppearanceShell } from "../parts/scaffold.js";

/** The one Changes row of a branch that removed the Payment terms document. */
const REMOVED_PAYMENT_TERMS: readonly NavNode[] = [
  {
    depth: 0,
    key: "payment-terms",
    kind: "document",
    label: "Payment terms · Removed",
    to: DESTINATIONS.appearanceLightOnlyDocument,
  },
];

/**
 * A removed Markdown document whose previous version was captured before the
 * catalogue enabled Dark, so it has a light render only. Its baseline crumbs
 * stay text, and Details stay closed.
 */
function LightOnlyDocument({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      design={DESTINATIONS.appearanceLightOnlyDocument}
      nav={
        <NavTree
          activeDestination={DESTINATIONS.appearanceLightOnlyDocument}
          changedCount={1}
          changedOnly
          nodes={REMOVED_PAYMENT_TERMS}
        />
      }
      viewport={viewport}
    >
      <ScreenHead
        comparisons={false}
        crumbs={["Account", "Billing & Payments"]}
        path={ENTRY_PATHS.paymentTerms}
        status="removed"
        title="Payment terms"
      />
      <PreviousVersionStage
        entry={{
          kind: "document",
          path: ENTRY_PATHS.paymentTerms,
          title: "Payment terms",
        }}
        lightOnly
        viewport={viewport}
      >
        <MarkdownStage lightOnly>
          <PaymentTerms />
        </MarkdownStage>
      </PreviousVersionStage>
      <DetailsPanel>
        <DetailsBody description="When an invoice is due, and what happens once it is late.">
          <MetaRow name="source" label="Source">
            Previous version
          </MetaRow>
          <MetaRow name="location" label="Location">
            Account › Billing &amp; Payments
          </MetaRow>
        </DetailsBody>
      </DetailsPanel>
    </AppearanceShell>
  );
}

/**
 * A removed document that the catalogue cannot show in both schemes. It
 * stays until decision 34 settles how the Canvas family shows a removed
 * entry's previous version.
 */
export const lightOnlyDocumentScreen = defineScreen({
  ...appearanceDesignMetadata,
  description:
    "A removed document whose previous version has no dark render, keeping its light page while the catalogue is Dark.",
  ...artboards({
    desktop: <LightOnlyDocument viewport="desktop" />,
    mobile: <LightOnlyDocument viewport="mobile" />,
  }),
  slug: "light-only-document",
  rationale:
    "A document has no frame label, so the fallback note joins the label it already has. A previous version captured before Dark existed cannot follow the setting; its pane keeps the light page it was rendered as, and the label says so instead of the reader guessing.",
  title: "Light-only document",
});
