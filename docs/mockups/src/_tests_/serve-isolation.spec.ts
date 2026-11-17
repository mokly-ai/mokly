import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

import { readCatalogueIndex } from "@mokly/viewer";

import { mockupsOrigin as origin } from "../../../../apps/mockups/src/_tests_/origins";
import {
  missingBase,
  recordedState,
  servedState,
} from "../../../../apps/mockups/src/_tests_/served-files";

import { catalogueEntries } from "./catalogue-index";
import { indexPath } from "./catalogue-paths";

/** The catalogue index that Serve answers, read by the viewer's reader. */
async function servedIndex(request: APIRequestContext) {
  const response = await request.get(origin + "/" + indexPath);
  expect(response.ok()).toBe(true);
  return readCatalogueIndex(await response.json());
}

test("Serve over a missing base keeps the build output and serves the complete inventory without Changes", async ({
  request,
}) => {
  expect(servedState()).toEqual(recordedState());
  await expect
    .poll(async () => (await servedIndex(request)).changesStatus, {
      timeout: 30_000,
    })
    .toBe("unavailable");
  const served = await servedIndex(request);
  expect(served.base).toBe(missingBase);
  expect(served.comparisonUrl).toBeNull();
  expect(
    catalogueEntries(served)
      .map(({ path }) => path)
      .sort(),
  ).toEqual(
    catalogueEntries()
      .map(({ path }) => path)
      .sort(),
  );
});
