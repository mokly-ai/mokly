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
  viewers: readonly { rootId: string; viewerId: string }[];
}

interface HydrationProbe {
  frame: HTMLIFrameElement | null;
  shell: HTMLElement | null;
}

const state = window as unknown as {
  fixture: HydrationFixtureData;
  viewerHydrationHarness: unknown;
  viewerHydrationProbe: Record<string, HydrationProbe>;
};
const recoverableErrors: string[] = [];

const viewers = state.fixture.viewers.map(({ rootId, viewerId }) => {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Missing hydration root ${rootId}`);
  const ref = createRef<MoklyViewerHandle>();
  hydrateRoot(
    root,
    <MoklyViewer
      viewerId={viewerId}
      baseUrl={state.fixture.baseUrl}
      catalogue={state.fixture.catalogue}
      defaultSelection={state.fixture.defaultSelection}
      ref={ref}
    />,
    {
      onRecoverableError(error) {
        const message = error instanceof Error ? error.message : String(error);
        recoverableErrors.push(`${viewerId}: ${message}`);
      },
    },
  );
  return { ref, root, rootId };
});

state.viewerHydrationHarness = {
  recoverableErrors,
  ready() {
    return viewers.every(({ ref }) => ref.current !== null);
  },
  retained() {
    return Object.fromEntries(
      viewers.map(({ root, rootId }) => {
        const probe = state.viewerHydrationProbe[rootId]!;
        return [
          rootId,
          {
            frame:
              probe.frame ===
              root.querySelector<HTMLIFrameElement>(".mbk-frag"),
            shell:
              probe.shell ===
              root.querySelector<HTMLElement>("[data-mokly-shell]"),
          },
        ];
      }),
    );
  },
};
