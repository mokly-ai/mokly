import { defineScreen } from "@mokly/mokly";

import {
  artboardStates,
  type ArtboardViewport,
} from "../../parts/artboards.js";
import { EmptyState, LoadingState } from "../../parts/stage_content.js";
import { CANVAS_PAGES as C } from "../parts/destinations.js";

import { startupMetadata } from "./parts/metadata.js";
import { StartupPage } from "./parts/startup.js";

/** A state of the page that the shell draws before the catalogue arrives. */
type StartupState = "failed" | "loading" | "version";

/** The artboard of each startup state. */
const PAGES = {
  loading: C.loadingCatalogue,
  failed: C.loadingCatalogueFailed,
  version: C.loadingCatalogueVersion,
} as const;

/**
 * The one state of a startup page: the loading line, or a failure whose one
 * action loads the catalogue again. A failure's action is a retry, so it
 * opens the loading line.
 */
function StartupState({ state }: { state: StartupState }) {
  switch (state) {
    case "loading":
      return <LoadingState status="Loading catalogue…" />;
    case "failed":
      return (
        <EmptyState
          linkLabel="Try again"
          title="The catalogue could not be loaded"
          to={C.loadingCatalogue}
        />
      );
    case "version":
      return (
        <EmptyState
          linkLabel="Reload"
          title="This catalogue needs a compatible viewer"
          to={C.loadingCatalogue}
        />
      );
  }
}

/** The page before the catalogue's index arrives, in one of its states. */
function Startup({
  state,
  viewport,
}: {
  state: StartupState;
  viewport: ArtboardViewport;
}) {
  return (
    <StartupPage design={PAGES[state]} viewport={viewport}>
      <StartupState state={state} />
    </StartupPage>
  );
}

export const canvasCatalogueLoadingScreen = defineScreen({
  ...startupMetadata,
  description:
    "One status line in the reader's appearance until the catalogue arrives. The shell draws no top bar, catalogue, or canvas before then, so the line takes the place of the whole viewer.",
  ...artboardStates(
    {
      state: "loading",
      title: "Loading",
      desktop: <Startup state="loading" viewport="desktop" />,
      mobile: <Startup state="loading" viewport="mobile" />,
    },
    [
      {
        description:
          "The catalogue could not be loaded. One action tries again, which shows the loading line.",
        desktop: <Startup state="failed" viewport="desktop" />,
        mobile: <Startup state="failed" viewport="mobile" />,
        slug: "failed",
        title: "Catalogue unavailable",
      },
      {
        description:
          "The catalogue and the viewer come from different Mokly versions. In Serve and the static build, Reload loads the viewer that matches the catalogue.",
        desktop: <Startup state="version" viewport="desktop" />,
        mobile: <Startup state="version" viewport="mobile" />,
        rationale:
          "Every host shows the same headline. Serve and the static build ship their matching viewer, so the standalone shell offers Reload. An embedded viewer shows no action and reports the failure to its host, because only the host can update the viewer.",
        slug: "version",
        title: "Incompatible viewer",
      },
    ],
  ),
  slug: "catalogue",
  rationale:
    "The shell has nothing to draw before the catalogue arrives, so the page shows one status line instead of empty chrome that would shift when the catalogue appears. The reader's appearance applies before then, so every startup state renders in both schemes, in the Canvas palette.",
  title: "Catalogue loading",
});
