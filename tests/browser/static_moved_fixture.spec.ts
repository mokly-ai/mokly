import { expect } from "@playwright/test";

import { movedFixturePaths as paths } from "../helpers/moved_fixture_sources.js";

import { test } from "./branch_point_test.js";
import {
  copiedBytes,
  deliveryIndex,
} from "./comparison_delivery_assertions.js";
import { expectComparisonFixture } from "./comparison_fixture_membership.js";
import { expectMovedInputs } from "./moved_fixture_assertions.js";

/** The copied host and Serve publish the same fixture classifications. */
test("the branch copy pins moved shapes, removed variants, and nested input evidence", async ({
  request,
  branchCopy,
}) => {
  const { index, generation } = await deliveryIndex(request, branchCopy.url);
  expectComparisonFixture(index);
  await expectMovedInputs(request, branchCopy.url);
  for (const [entryPath, text, file] of [
    [paths.removedActionVariant, "Go back", "index.desktop.html"],
    [paths.removedInvoiceVariant, "Paid invoice", "index.mobile.html"],
    ["branch/moves/previous/guide", "Payment guide", "index.html"],
  ]) {
    const bytes = await copiedBytes(
      request,
      branchCopy.directory,
      `${generation}snapshots/before/mokly-generated/${entryPath}/${file}`,
    );
    expect(bytes.toString()).toContain(text);
  }
});
