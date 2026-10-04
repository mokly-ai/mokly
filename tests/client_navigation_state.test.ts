import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultSelection,
  revealSelection,
} from "../packages/viewer/dist/viewer/selection.js";

import {
  noTitles,
  selectionModel,
} from "./helpers/navigation_state_fixture.js";

test("active-row selection clears only constraints that hide it", () => {
  const unchanged = selectionModel(false);
  assert.deepEqual(
    revealSelection(unchanged, noTitles, {
      ...defaultSelection,
      screenPath: "product/browse/details",
      search: "welcome",
      view: "changes",
    }),
    {
      ...defaultSelection,
      screenPath: "product/browse/details",
      search: "",
      view: "all",
    },
  );
  const changed = selectionModel(true);
  const matching = {
    ...defaultSelection,
    screenPath: "product/browse/details",
    search: "details",
    view: "changes" as const,
  };
  assert.deepEqual(revealSelection(changed, noTitles, matching), matching);
  const derivedRouteOnly = {
    ...defaultSelection,
    screenPath: "product/browse/details",
    search: "screens/details",
  };
  assert.deepEqual(revealSelection(unchanged, noTitles, derivedRouteOnly), {
    ...derivedRouteOnly,
    search: "",
  });
});

test("a tag term clears the query only for a row that lacks the tag", () => {
  const model = selectionModel(false);
  const selected = (
    screenPath: string,
    search: string,
    tags: readonly string[],
  ) =>
    revealSelection(model, noTitles, {
      ...defaultSelection,
      screenPath,
      search,
      tags,
    });
  assert.deepEqual(selected("welcome", "", ["onboarding"]), {
    ...defaultSelection,
    screenPath: "welcome",
    tags: ["onboarding"],
  });
  assert.deepEqual(selected("product/browse/details", "", ["onboarding"]), {
    ...defaultSelection,
    screenPath: "product/browse/details",
  });
  assert.deepEqual(
    selected("product/browse/details", "product/browse/details", ["forms"]),
    {
      ...defaultSelection,
      screenPath: "product/browse/details",
      search: "product/browse/details",
      tags: ["forms"],
    },
  );
  assert.deepEqual(selected("product/browse/details", "welcome", ["forms"]), {
    ...defaultSelection,
    screenPath: "product/browse/details",
  });
});
