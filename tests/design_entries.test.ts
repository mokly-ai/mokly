import assert from "node:assert/strict";
import test from "node:test";

import { designCatalogue, designEntries } from "./helpers/design_catalogue.js";

test("catalogue selections reject empty results with their label", async () => {
  await assert.rejects(
    designEntries(() => false, "selection regression"),
    { message: "No design entries matched: selection regression" },
  );
});

test("baseline selections keep the supplied entries and reject empty results", async () => {
  const { manifest } = await designCatalogue;
  const baseline = manifest.entries.slice(0, 1);
  const selected = await designEntries(() => true, "baseline", baseline);
  assert.deepEqual(selected, baseline);
  assert.equal(selected[0], baseline[0]);
  await assert.rejects(
    designEntries(() => true, "empty baseline", []),
    {
      message: "No design entries matched: empty baseline",
    },
  );
});
