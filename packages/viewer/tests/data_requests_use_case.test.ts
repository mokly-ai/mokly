import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { routeDetailRequests } from "../src/shell/data_requests.js";
import { routeFromUrl } from "../src/shell/routes.js";

import { catalogueFixture, indexFixture } from "./catalogue_v9_fixture.js";

const HOME = "product/browse/home";
const DETAILS = "product/browse/details";
const EMPTY = "product/browse/home/empty";

/** The tour route of the original catalogue, as the shell holds it. */
const tour = routeFromUrl(
  catalogueFixture(),
  new URL("/view/tour/", "https://catalogue.test"),
);

/** Set the tour's steps and each screen's use-case links to match them. */
function tourSteps(paths: readonly string[]): CatalogueReadModel {
  return indexFixture((raw) => {
    raw.useCases[0]!.steps = paths.map((screenPath) => ({ screenPath }));
    for (const screen of raw.screens)
      screen.useCasePaths = paths.includes(screen.path) ? ["tour"] : [];
  });
}

test("a refreshed use case requests the steps of the new index", () => {
  assert.deepEqual(routeDetailRequests(tourSteps([HOME]), tour), [
    { path: "tour" },
    { path: HOME },
  ]);
  assert.deepEqual(
    routeDetailRequests(tourSteps([HOME, DETAILS, EMPTY]), tour),
    [{ path: "tour" }, { path: HOME }, { path: DETAILS }, { path: EMPTY }],
  );
  assert.deepEqual(routeDetailRequests(tourSteps([EMPTY, HOME, EMPTY]), tour), [
    { path: "tour" },
    { path: EMPTY },
    { path: HOME },
  ]);
});
