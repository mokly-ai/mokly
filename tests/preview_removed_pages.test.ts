import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { readCatalogue } from "@mokly/viewer";

import { assertPublishedPagePreview } from "./helpers/published_preview.js";
import {
  createRemovedDeliveryFixture,
  prepareRemovedPreviewEntrypoint,
} from "./helpers/removed_delivery_fixture.js";

const execute = promisify(execFile);

test("the npm preview entrypoint advertises a removed page's packaged bytes", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  await prepareRemovedPreviewEntrypoint(fixture);
  const output = path.join(fixture.root, ".context/entrypoint");
  await execute(
    "npm",
    [
      "run",
      "preview:build",
      "--",
      "--include-changes",
      "--base",
      "origin/main",
      "--out",
      output,
    ],
    { cwd: fixture.root },
  );
  const model = readCatalogue(
    JSON.parse(
      await fs.readFile(path.join(output, "__mokly/catalogue.json"), "utf8"),
    ),
  );
  const page = model.removedEntries.find(
    ({ entry }) => entry.route === "archive/removed.html",
  );
  assert.ok(page?.preview?.kind === "page");
  await assertPublishedPagePreview(output, page.preview);
});
