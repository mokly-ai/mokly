import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";

import { MoklyViewer } from "@mokly/viewer";
import type {
  CatalogueReadModel,
  MoklyViewerHandle,
  ViewerSelection,
} from "@mokly/viewer";

interface HydrationFixtureData {
  baseUrl: string;
  catalogue: CatalogueReadModel;
  defaultSelection: ViewerSelection;
}

interface HydrationProbe {
  frame: HTMLIFrameElement | null;
  shell: HTMLElement | null;
}

const state = window as unknown as {
  fixture: HydrationFixtureData;
  viewerHydrationHarness: unknown;
  viewerHydrationProbe: HydrationProbe;
};
const root = document.querySelector<HTMLElement>("#hydration-root");
if (!root) throw new Error("Missing hydration root");
const ref = createRef<MoklyViewerHandle>();
const recoverableErrors: string[] = [];

hydrateRoot(
  root,
  <MoklyViewer
    baseUrl={state.fixture.baseUrl}
    catalogue={state.fixture.catalogue}
    defaultSelection={state.fixture.defaultSelection}
    ref={ref}
  />,
  {
    onRecoverableError(error) {
      recoverableErrors.push(
        error instanceof Error ? error.message : String(error),
      );
    },
  },
);

state.viewerHydrationHarness = {
  recoverableErrors,
  ref,
  retained() {
    return {
      frame:
        state.viewerHydrationProbe.frame ===
        root.querySelector<HTMLIFrameElement>(".mbk-frag"),
      shell:
        state.viewerHydrationProbe.shell ===
        root.querySelector<HTMLElement>("[data-mokly-shell]"),
    };
  },
};
