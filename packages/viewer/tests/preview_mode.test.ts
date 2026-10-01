import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import {
  advancedViewerInteractive,
  type ViewerInteractiveDescriptor,
} from "../src/client/interactive_capability.js";
import { controlsUnavailable } from "../src/shell/component_controls_state.js";
import {
  liveFrameOrigin,
  liveFrameSource,
} from "../src/shell/live_frame_source.js";
import {
  LIVE_PREVIEW_COPY,
  liveGenerationKey,
  livePreviewAvailability,
  livePreviewView,
  liveViewKey,
  withLiveUnavailable,
  withPreviewMode,
} from "../src/shell/preview_mode.js";
import { shellRecoverySnapshot } from "../src/shell/store_actions.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import type {
  WorkspaceData,
  WorkspaceVariant,
} from "../src/shell/workspace_data.js";
import { inspectionAvailability } from "../src/shell/workspace_inspection_runtime.js";
import { parseBrowseRecoveryState } from "../src/standalone/recovery.js";
import {
  viewerCatalogue,
  viewerContext,
  viewerView,
} from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

type AvailabilityInput = Parameters<typeof livePreviewAvailability>[0];

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v3.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const catalogue = viewerCatalogue(model);
const generation = "c".repeat(32);
const descriptor: ViewerInteractiveDescriptor = {
  generation,
  port: 4174,
  state: "idle",
};
const component = catalogue.byId.get("action");
const componentVariant = catalogue.byId.get("action-default");
const screen = catalogue.byId.get("home");
if (
  component?.kind !== "component" ||
  componentVariant?.kind !== "component" ||
  !("variantOf" in componentVariant) ||
  screen?.kind !== "screen"
)
  throw new Error("Missing preview mode fixtures");
const savedVariant: WorkspaceVariant = {
  comparisonEligible: false,
  removed: false,
  value: componentVariant,
};

function initialState() {
  return createInitialShellState(
    catalogue,
    viewerContext(model, defaultSelection),
    viewerView(catalogue, { ...defaultSelection, screenId: "home" }),
    undefined,
  );
}

test("only current screens and saved variants name a Live view", () => {
  const screenData = { entry: screen, removed: false } as WorkspaceData;
  const componentData = { entry: component, removed: false } as WorkspaceData;
  assert.deepEqual(livePreviewView(screenData, { comparisonEligible: false }), {
    entryId: "home",
  });
  assert.deepEqual(
    livePreviewView(componentData, {
      comparisonEligible: false,
      variant: savedVariant,
    }),
    { entryId: "action", variantId: "action-default" },
  );
  assert.equal(
    livePreviewView(
      { ...screenData, removed: true },
      { comparisonEligible: false },
    ),
    undefined,
  );
  assert.equal(
    livePreviewView(componentData, {
      comparisonEligible: false,
      variant: { ...savedVariant, removed: true },
    }),
    undefined,
  );
});

test("availability is absent without Live and disabled only where it failed", () => {
  const known = (input: Omit<AvailabilityInput, "eligibility" | "retained">) =>
    livePreviewAvailability({
      ...input,
      eligibility: "eligible",
      retained: false,
    });
  const view = { entryId: "action", variantId: "default" };
  const other = { entryId: "home" };
  assert.equal(known({ descriptor: undefined, unavailable: [], view }), "none");
  assert.equal(known({ descriptor, unavailable: [], view: undefined }), "none");
  assert.equal(known({ descriptor, unavailable: [], view }), "available");
  assert.equal(
    known({
      descriptor: { ...descriptor, state: "failed" },
      unavailable: [],
      view,
    }),
    "unavailable",
  );
  const failedView = [liveViewKey(generation, view)];
  assert.equal(
    known({ descriptor, unavailable: failedView, view }),
    "unavailable",
  );
  assert.equal(
    known({
      descriptor,
      unavailable: failedView,
      view: other,
    }),
    "available",
  );
  assert.equal(
    known({
      descriptor,
      unavailable: [liveGenerationKey(generation)],
      view: other,
    }),
    "unavailable",
  );
  assert.equal(
    known({
      descriptor: { ...descriptor, generation: "d".repeat(32) },
      unavailable: [liveGenerationKey(generation), ...failedView],
      view,
    }),
    "available",
  );
  assert.notEqual(
    liveViewKey(generation, { entryId: "a/b" }),
    liveViewKey(generation, { entryId: "a", variantId: "b" }),
  );
});

test("preview mode starts Static and failures return to Static once", () => {
  const state = initialState();
  assert.equal(state.previewMode, "static");
  assert.deepEqual(state.liveUnavailable, []);
  assert.equal(withPreviewMode(state, "static"), state);
  const live = withPreviewMode(state, "live");
  assert.equal(live.previewMode, "live");
  const key = liveViewKey(generation, { entryId: "home" });
  const failed = withLiveUnavailable(live, key);
  assert.equal(failed.previewMode, "static");
  assert.deepEqual(failed.liveUnavailable, [key]);
  assert.equal(withLiveUnavailable(failed, key), failed);
  const again = withLiveUnavailable(withPreviewMode(failed, "live"), key);
  assert.equal(again.previewMode, "static");
  assert.deepEqual(again.liveUnavailable, [key]);
});

test("a watched reload restores Live once while a manual load starts Static", () => {
  const live = withPreviewMode(initialState(), "live");
  const snapshot = shellRecoverySnapshot(live, false);
  assert.equal(snapshot.previewMode, "live");
  const recovered = createInitialShellState(
    catalogue,
    viewerContext(model, defaultSelection),
    viewerView(catalogue, { ...defaultSelection, screenId: "home" }),
    { recovery: snapshot },
  );
  assert.equal(recovered.previewMode, "live");
  assert.deepEqual(recovered.liveUnavailable, []);
  const { view: _view, ...browse } = snapshot;
  const stored = { ...browse, changedOnly: false };
  assert.equal(parseBrowseRecoveryState(stored)?.previewMode, "live");
  const { previewMode: _previewMode, ...older } = stored;
  const parsedOlder = parseBrowseRecoveryState(older);
  assert.ok(parsedOlder);
  assert.equal("previewMode" in parsedOlder, false);
  assert.equal(
    parseBrowseRecoveryState({ ...stored, previewMode: "interactive" }),
    undefined,
  );
});

test("the Live origin is explicit or the shell host with the announced port", () => {
  const shell = { hostname: "localhost", protocol: "http:" };
  assert.equal(liveFrameOrigin(descriptor, shell), "http://localhost:4174");
  assert.equal(
    liveFrameOrigin(descriptor, { hostname: "127.0.0.1", protocol: "http:" }),
    "http://127.0.0.1:4174",
  );
  assert.equal(
    liveFrameOrigin(descriptor, { hostname: "[::1]", protocol: "http:" }),
    "http://[::1]:4174",
  );
  assert.equal(
    liveFrameOrigin(
      { ...descriptor, origin: "https://live.example.test" },
      shell,
    ),
    "https://live.example.test",
  );
  assert.equal(
    liveFrameOrigin(descriptor, { hostname: "", protocol: "file:" }),
    undefined,
  );
});

test("Live documents keep the static path, query and fragment on the Live origin", () => {
  const origin = "http://127.0.0.1:4174";
  assert.equal(
    liveFrameSource("/static/screens/home.mobile.html", origin),
    `${origin}/static/screens/home.mobile.html`,
  );
  assert.equal(
    liveFrameSource(
      "/static/components/action.variants/default.desktop.html?viewport=desktop#hero",
      origin,
    ),
    `${origin}/static/components/action.variants/default.desktop.html?viewport=desktop#hero`,
  );
  assert.equal(
    liveFrameSource(
      "http://127.0.0.1:4173/static/screens/home.desktop.html",
      origin,
    ),
    `${origin}/static/screens/home.desktop.html`,
  );
  assert.equal(
    liveFrameSource(
      `/__mokly/components/renders/${"a".repeat(48)}.${"b".repeat(64)}/view.html`,
      origin,
    ),
    undefined,
  );
});

test("a generation's ready or failed result is final for its listener", () => {
  const building = { ...descriptor, state: "building" as const };
  const ready = { ...descriptor, state: "ready" as const };
  assert.equal(advancedViewerInteractive(descriptor, building), building);
  assert.equal(advancedViewerInteractive(building, ready), ready);
  assert.equal(advancedViewerInteractive(ready, building), ready);
  const failed = { ...descriptor, state: "failed" as const };
  assert.equal(advancedViewerInteractive(failed, ready), failed);
  const next = { ...building, generation: "e".repeat(32) };
  assert.equal(advancedViewerInteractive(ready, next), next);
  assert.equal(advancedViewerInteractive(undefined, building), building);
});

test("Live makes highlighting and prop editing wait for Static", () => {
  const data = { entry: component, removed: false } as WorkspaceData;
  assert.equal(
    controlsUnavailable(data, savedVariant, false, true, true),
    LIVE_PREVIEW_COPY.notice,
  );
  assert.equal(
    controlsUnavailable(data, savedVariant, true, true, true),
    "Comparisons show the saved variant. Return to Current to edit props.",
  );
  const context = {
    comparisonActive: false,
    data,
    invalidSelection: false,
    liveActive: true,
    views: [],
  };
  assert.deepEqual(inspectionAvailability(context, []), {
    available: false,
    reason: "Highlighting works in Static.",
  });
  assert.deepEqual(
    inspectionAvailability({ ...context, comparisonActive: true }, []),
    { available: false, reason: "Highlighting is available in Current." },
  );
});
