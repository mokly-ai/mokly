/** Browser-only harness for the comparison hook's evidence and mode lifetime. */

import { createRoot, type Root } from "react-dom/client";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import {
  ComparisonEnvironmentProvider,
  type ComparisonEnvironment,
} from "../src/shell/comparison_context.js";
import type { ComparisonMode } from "../src/shell/comparison_presentation.js";
import { shellStore } from "../src/shell/store_actions.js";
import { ShellStoreBoundary } from "../src/shell/store_context.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import {
  useComparison,
  type ComparisonController,
} from "../src/shell/use_comparison.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

interface HookInput {
  eligible: boolean;
  entryId: string;
  evidence: number;
  updateVersion: number;
}

interface HookHarness {
  start(
    model: CatalogueReadModel,
    review: unknown,
    pinned?: boolean,
    initialSide?: boolean,
    eligible?: boolean,
  ): void;
  update(partial: Partial<HookInput>): void;
  select(mode: ComparisonMode): void;
  snapshot(): {
    busy: boolean;
    loaded: boolean;
    mode: ComparisonMode;
    requests: readonly string[];
  };
}

declare global {
  interface Window {
    comparisonHookHarness: HookHarness;
  }
}

let root: Root;
let model: CatalogueReadModel;
let environment: ComparisonEnvironment;
let controller: ComparisonController;
let input: HookInput;
let requests: string[];

function Probe() {
  controller = useComparison({
    eligible: input.eligible,
    entryId: input.entryId,
    owner: "home",
  });
  return (
    <output
      data-hook-mode={controller.mode}
      data-hook-loaded={String(Boolean(controller.loaded))}
      data-hook-busy={String(controller.busy)}
    />
  );
}

function render() {
  const catalogue = viewerCatalogue({
    ...model,
    revision: { ...model.revision, evidence: input.evidence },
  });
  const context = {
    ...viewerContext(model, defaultSelection),
    updateVersion: input.updateVersion,
  };
  const state = createInitialShellState(
    catalogue,
    context,
    { kind: "home" },
    undefined,
  );
  const store = shellStore({
    catalogue,
    context,
    embedded: true,
    interactive: true,
    sections: [],
    state,
    stateRef: { current: state },
    setState() {},
    propose() {},
    navigation: {
      navigateFrame() {},
      onShellClick() {},
      onShellKeyDown() {},
      openFrame() {},
    },
  });
  root.render(
    <ShellStoreBoundary value={store}>
      <ComparisonEnvironmentProvider
        context={context}
        environment={environment}
        interactive
      >
        <Probe />
      </ComparisonEnvironmentProvider>
    </ShellStoreBoundary>,
  );
}

window.comparisonHookHarness = {
  start(value, review, pinned = false, initialSide = false, eligible = true) {
    model = value;
    input = {
      eligible,
      entryId: "home",
      evidence: value.revision.evidence,
      updateVersion: 1,
    };
    requests = [];
    environment = {
      baseUrl: location.origin,
      delivery: () =>
        pinned
          ? { kind: "pinned", comparisonUrl: "diffs/review.json" }
          : { kind: "live" },
      initialMode: () => (initialSide ? "side" : undefined),
      fetch: async (url, init) => {
        const method = init?.method ?? "GET";
        requests.push(method);
        const response = new Response(
          method === "HEAD" ? null : JSON.stringify(review),
          { status: 200 },
        );
        Object.defineProperty(response, "url", {
          value:
            method === "HEAD" || pinned
              ? String(url)
              : `${location.origin}/__mokly/diffs/__generations/selected-hook/review.json`,
        });
        return response;
      },
    };
    root = createRoot(
      document.body.appendChild(document.createElement("section")),
    );
    render();
  },
  update(partial) {
    input = { ...input, ...partial };
    render();
  },
  select(mode) {
    controller.selectMode(mode);
  },
  snapshot() {
    return {
      busy: controller.busy,
      loaded: Boolean(controller.loaded),
      mode: controller.mode,
      requests: [...requests],
    };
  },
};
