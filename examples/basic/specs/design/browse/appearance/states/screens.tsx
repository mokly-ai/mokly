import { defineScreen } from "@mokly/mokly";

import { appearanceDesignMetadata } from "../../../metadata.js";
import { DESTINATIONS } from "../../../parts/destinations.js";
import { DetailsPanel } from "../../../parts/details.js";
import { ENTRY_PATHS } from "../../../parts/entry_paths.js";
import { MarkdownStage } from "../../../parts/markdown.js";
import { MetaRow } from "../../../parts/metadata_row.js";
import { NavTree, type NavNode } from "../../../parts/nav.js";
import { PreviousVersionLabel } from "../../../parts/removed_preview.js";
import { ScreenHead, type ArtboardViewport } from "../../../parts/shell.js";
import { PaymentTerms } from "../../../parts/spec_documents.js";
import {
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
      <AppearanceHead
        path={ENTRY_PATHS.details}
        title="Details"
        viewport={viewport}
      />
      <AppearanceWorkspace subject="details" viewport={viewport} />
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
      <AppearanceHead
        path={ENTRY_PATHS.welcome}
        title="Welcome"
        viewport={viewport}
      />
      <AppearanceWorkspace subject="welcome" viewport={viewport} />
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
      <PreviousVersionLabel lightOnly />
      <MarkdownStage lightOnly>
        <PaymentTerms />
      </MarkdownStage>
      <DetailsPanel>
        <div className="mbk-details-body">
          <div>
            <p className="mbk-details-desc">
              When an invoice is due, and what happens once it is late.
            </p>
            <p>Location: Account › Billing &amp; Payments</p>
          </div>
          <div className="mbk-meta">
            <MetaRow name="source" label="Source">
              Previous version
            </MetaRow>
          </div>
        </div>
      </DetailsPanel>
    </AppearanceShell>
  );
}

/**
 * The Auto setting, and a screen and a document the catalogue cannot show in
 * both schemes.
 */
export const appearanceStateScreens = [
  defineScreen({
    ...appearanceDesignMetadata,
    description:
      "The Appearance setting left on Auto, following the reader's system.",
    desktop: <AutoAppearance viewport="desktop" />,
    slug: "auto",
    mobile: <AutoAppearance viewport="mobile" />,
    rationale:
      "Auto is the default and follows the system, including a change made while the catalogue is open. Each generated file depicts the system resolving to the scheme it was rendered for, so the example never reads the building or viewing machine's own setting.",
    title: "Auto appearance",
  }),
  defineScreen({
    ...appearanceDesignMetadata,
    description:
      "A screen with no dark render, keeping its light frames while the catalogue changes.",
    desktop: <LightOnlyScreen viewport="desktop" />,
    slug: "light-only",
    mobile: <LightOnlyScreen viewport="mobile" />,
    rationale:
      "One setting changes the catalogue and the screens it shows together, but a screen that renders in light only cannot follow. It keeps its real light frames and names that fallback in its caption, which is a fact about the screen rather than a second setting.",
    title: "Light-only screen",
  }),
  defineScreen({
    ...appearanceDesignMetadata,
    description:
      "A removed document whose previous version has no dark render, keeping its light page while the catalogue is Dark.",
    desktop: <LightOnlyDocument viewport="desktop" />,
    slug: "light-only-document",
    mobile: <LightOnlyDocument viewport="mobile" />,
    rationale:
      "A document has no frame label, so the fallback note joins the label it already has. A previous version captured before Dark existed cannot follow the setting; its pane keeps the light page it was rendered as, and the label says so instead of the reader guessing.",
    title: "Light-only document",
  }),
];
