import { defineScreen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { designMetadata } from "./metadata.js";
import { artboards } from "./parts/artboards.js";
import { DESTINATIONS } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { ENTRY_PATHS, SCREEN_CRUMBS } from "./parts/entry_paths.js";
import { MiniWelcome } from "./parts/mini_screens.js";
import { miniView } from "./parts/mini_views.js";
import { NavTree } from "./parts/nav.js";
import { reasonEvidence } from "./parts/reason_sentences.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
} from "./parts/shell.js";
import { BrowserFrame, PhoneFrame } from "./parts/stage.js";

function CatalogueView({
  viewport,
  changes,
}: {
  viewport: ArtboardViewport;
  changes: boolean;
}) {
  return (
    <Shell
      design={
        changes ? DESTINATIONS.publicationChanges : DESTINATIONS.publication
      }
      viewport={viewport}
      nav={<NavTree changes={changes} activeLabel="Welcome" />}
    >
      <PreviewWorkspace
        header={
          <ScreenHead
            comparisons={changes}
            crumbs={SCREEN_CRUMBS}
            path={ENTRY_PATHS.welcome}
            title="Welcome"
            action={<ViewSwitch active={viewport} />}
          />
        }
        inspector={
          <DetailsPanel
            subject="welcome"
            comparisonEvidence={
              changes ? { reasons: reasonEvidence(["material"]) } : undefined
            }
          />
        }
        view={miniView("welcome")}
        viewport={viewport}
        render={(previewViewport) =>
          previewViewport === "desktop" ? (
            <BrowserFrame address="example.test/welcome">
              <MiniWelcome />
            </BrowserFrame>
          ) : (
            <PhoneFrame small={viewport === "mobile"}>
              <MiniWelcome compact />
            </PhoneFrame>
          )
        }
      />
    </Shell>
  );
}
function CatalogueDesktop() {
  return <CatalogueView viewport="desktop" changes={false} />;
}
function CatalogueMobile() {
  return <CatalogueView viewport="mobile" changes={false} />;
}
function ChangesDesktop() {
  return <CatalogueView viewport="desktop" changes />;
}
function ChangesMobile() {
  return <CatalogueView viewport="mobile" changes />;
}

/** Owning designs for a catalogue with review omitted or included. */
export const catalogueScreen = defineScreen({
  ...designMetadata,
  slug: "catalogue",
  title: "Current catalogue",
  description: "Navigation, search and variants with review omitted.",
  colorSchemes: ["light"],
  ...artboards({ desktop: <CatalogueDesktop />, mobile: <CatalogueMobile /> }),
});
export const changesScreen = defineScreen({
  ...designMetadata,
  slug: "changes",
  title: "Catalogue with Changes",
  description:
    "The same catalogue with Changes and optional screen comparisons.",
  colorSchemes: ["light"],
  ...artboards({ desktop: <ChangesDesktop />, mobile: <ChangesMobile /> }),
});
