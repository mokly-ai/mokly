import { defineScreen } from "@mokly/mokly";

import { DetailsBody } from "../../../../../../../packages/ui/src/details-panel/details-panel.js";
import { MetadataCode } from "../../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { LightOnlyBand } from "../../../../../../../packages/ui/src/scheme-fallback/scheme-fallback.js";
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
import {
  APPEARANCE_NAV_TREE,
  AppearanceHead,
  AppearanceShell,
  AppearanceWorkspace,
} from "../parts/scaffold.js";

function LightOnlyScreen({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Details"
      design={DESTINATIONS.appearanceLightOnly}
      viewport={viewport}
    >
      <AppearanceWorkspace
        header={
          <AppearanceHead
            path={ENTRY_PATHS.details}
            title="Details"
            viewport={viewport}
          />
        }
        subject="details"
        viewport={viewport}
      />
    </AppearanceShell>
  );
}

function AutoAppearance({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      appearanceChoice="auto"
      design={DESTINATIONS.appearanceAuto}
      viewport={viewport}
    >
      <AppearanceWorkspace
        header={
          <AppearanceHead
            path={ENTRY_PATHS.welcome}
            title="Welcome"
            viewport={viewport}
          />
        }
        subject="welcome"
        viewport={viewport}
      />
    </AppearanceShell>
  );
}

/**
 * The current Payment terms document while the catalogue is Dark. It has no
 * dark render, so its pane keeps the light page, and a quiet band above the
 * pane names that fallback. Details stay closed.
 */
function LightOnlyCurrentDocument({
  viewport,
}: {
  viewport: ArtboardViewport;
}) {
  return (
    <AppearanceShell
      design={DESTINATIONS.appearanceLightOnlyCurrent}
      nav={
        <NavTree
          activeDestination={DESTINATIONS.appearanceLightOnlyCurrent}
          nodes={APPEARANCE_NAV_TREE}
        />
      }
      viewport={viewport}
    >
      <ScreenHead
        comparisons={false}
        crumbs={["Account", "Billing & Payments"]}
        path={ENTRY_PATHS.paymentTerms}
        title="Payment terms"
      />
      <LightOnlyBand />
      <MarkdownStage lightOnly>
        <PaymentTerms />
      </MarkdownStage>
      <DetailsPanel>
        <DetailsBody description="When an invoice is due, and what happens once it is late.">
          <MetaRow name="source" label="Source">
            <MetadataCode>specs/account/billing/payment-terms.md</MetadataCode>
          </MetaRow>
        </DetailsBody>
      </DetailsPanel>
    </AppearanceShell>
  );
}

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
 * The Auto setting, and a screen, a current document, and a removed document
 * the catalogue cannot show in both schemes.
 */
export const autoScreen = defineScreen({
  ...appearanceDesignMetadata,
  description:
    "The Appearance setting left on Auto, following the reader's system.",
  ...artboards({
    desktop: <AutoAppearance viewport="desktop" />,
    mobile: <AutoAppearance viewport="mobile" />,
  }),
  slug: "auto",
  rationale:
    "Auto is the default and follows the system, including a change made while the catalogue is open. Each generated file depicts the system resolving to the scheme it was rendered for, so the example never reads the building or viewing machine's own setting.",
  title: "Auto appearance",
});
export const lightOnlyScreen = defineScreen({
  ...appearanceDesignMetadata,
  description:
    "A screen with no dark render, keeping its light frames while the catalogue changes.",
  ...artboards({
    desktop: <LightOnlyScreen viewport="desktop" />,
    mobile: <LightOnlyScreen viewport="mobile" />,
  }),
  slug: "light-only",
  rationale:
    "One setting changes the catalogue and the screens it shows together, but a screen that renders in light only cannot follow. It keeps its real light frames and names that fallback in its caption, which is a fact about the screen rather than a second setting.",
  title: "Light-only screen",
});
export const lightOnlyCurrentScreen = defineScreen({
  ...appearanceDesignMetadata,
  description:
    "A current document with no dark render, keeping its light page under Dark below a Light only band.",
  ...artboards({
    desktop: <LightOnlyCurrentDocument viewport="desktop" />,
    mobile: <LightOnlyCurrentDocument viewport="mobile" />,
  }),
  slug: "light-only-current",
  rationale:
    "A document renders in every scheme the catalogue sets, so it lacks a dark page only while the catalogue offers Dark for something else, such as a removed screen it still shows. Its pane keeps the light page, and because a document has no frame label, a quiet band above the pane names the fallback.",
  title: "Light-only current document",
});
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
