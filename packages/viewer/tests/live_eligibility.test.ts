import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { ViewerInteractiveDescriptor } from "../src/client/interactive_capability.js";
import {
  liveEligibility,
  liveGenerationKey,
  livePreviewAvailability,
  liveViewKey,
  type LiveEligibility,
} from "../src/shell/preview_mode.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

const catalogue = viewerCatalogue(
  readCatalogue(
    JSON.parse(
      fs.readFileSync(
        new URL(
          "../../../docs/protocol/fixtures/catalogue-v3.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  ),
);
const screen = catalogue.byId.get("home");
const component = catalogue.byId.get("action");
if (screen?.kind !== "screen" || component?.kind !== "component")
  throw new Error("Missing Live eligibility fixtures");
const generation = "e".repeat(32);
const descriptor: ViewerInteractiveDescriptor = {
  generation,
  port: 4174,
  state: "ready",
};
const view = { entryId: "home" };

function adopted(
  entry: WorkspaceData["entry"],
  interactive?: boolean,
): WorkspaceData {
  return {
    entry,
    removed: false,
    ...(interactive === undefined ? {} : { interactive }),
  } as WorkspaceData;
}

function availability(eligibility: LiveEligibility, retained: boolean) {
  return livePreviewAvailability({
    descriptor,
    eligibility,
    retained,
    unavailable: [],
    view,
  });
}

test("only an adopted true value makes a screen or component eligible", () => {
  for (const entry of [screen, component]) {
    for (const pending of [false, true]) {
      assert.equal(
        liveEligibility({ entry, pending, workspace: adopted(entry, true) }),
        "eligible",
      );
      assert.equal(
        liveEligibility({ entry, pending, workspace: adopted(entry, false) }),
        "ineligible",
      );
      assert.equal(
        liveEligibility({ entry, pending, workspace: adopted(entry) }),
        "ineligible",
        "an adopted workspace without a value is unknown and fails closed",
      );
    }
  }
});

test("an entry without its adopted workspace is pending until the request settles", () => {
  assert.equal(
    liveEligibility({ entry: screen, pending: true, workspace: undefined }),
    "pending",
  );
  assert.equal(
    liveEligibility({ entry: screen, pending: false, workspace: undefined }),
    "ineligible",
  );
  const previous = adopted(component, true);
  assert.equal(
    liveEligibility({ entry: screen, pending: true, workspace: previous }),
    "pending",
    "another entry's eligibility never answers for this entry",
  );
  assert.equal(
    liveEligibility({ entry: screen, pending: false, workspace: previous }),
    "ineligible",
  );
});

test("an opted-out or unknown view offers no control, whatever was retained", () => {
  for (const retained of [false, true]) {
    assert.equal(availability("ineligible", retained), "none");
    assert.equal(availability("eligible", retained), "available");
  }
  assert.equal(
    livePreviewAvailability({
      descriptor: undefined,
      eligibility: "eligible",
      retained: true,
      unavailable: [],
      view,
    }),
    "none",
  );
});

test("a pending view keeps the presence the previous view displayed", () => {
  assert.equal(availability("pending", false), "none");
  assert.equal(availability("pending", true), "pending");
  assert.equal(
    livePreviewAvailability({
      descriptor,
      eligibility: "pending",
      retained: true,
      unavailable: [],
      view: undefined,
    }),
    "none",
    "pages, flows and removed entries never retain the control",
  );
  for (const unavailable of [
    [liveGenerationKey(generation)],
    [liveViewKey(generation, view)],
  ])
    assert.equal(
      livePreviewAvailability({
        descriptor,
        eligibility: "pending",
        retained: true,
        unavailable,
        view,
      }),
      "unavailable",
    );
  assert.equal(
    livePreviewAvailability({
      descriptor: { ...descriptor, state: "failed" },
      eligibility: "pending",
      retained: true,
      unavailable: [],
      view,
    }),
    "unavailable",
  );
});
