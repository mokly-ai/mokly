import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";

import { ownedEntries } from "../dist/export/ownership.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { assertPublishedPagePreview } from "./helpers/published_preview.js";
import { createRemovedDeliveryFixture } from "./helpers/removed_delivery_fixture.js";

test("repository publication packages previews and default replacement removes them", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  const output = path.join(fixture.root, ".context/published");
  const originalFetch = globalThis.fetch;
  const requests: { method: string; url: string }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (...args: Parameters<typeof originalFetch>) => {
      requests.push({
        method:
          args[0] instanceof Request
            ? args[0].method
            : (args[1]?.method ?? "GET"),
        url: args[0] instanceof Request ? args[0].url : String(args[0]),
      });
      return originalFetch(...args);
    },
  );
  await buildPreview(fixture.config, output, {
    base: "origin/main",
    includeChanges: true,
  });
  const withChanges = readCatalogue(
    JSON.parse(
      await fs.readFile(path.join(output, "__mokly/catalogue.json"), "utf8"),
    ),
  );
  const page = withChanges.removedEntries.find(
    ({ entry }) => entry.id === "removed-page",
  );
  assert.ok(page?.preview?.kind === "page");
  await assertPublishedPagePreview(output, page.preview);
  await fs.access(path.join(output, "__mokly/client/react-shell.js"));
  await fs.access(
    path.join(
      output,
      path.posix.dirname(withChanges.comparisonUrl!),
      "pages/removed-page.json",
    ),
  );
  await fs.access(
    path.join(
      output,
      path.posix.dirname(withChanges.comparisonUrl!),
      "snapshots/before/assets/past.png",
    ),
  );
  assert.deepEqual(
    requests.filter(({ method, url }) => {
      const request = new URL(url);
      return (
        method === "HEAD" ||
        request.searchParams.has("page") ||
        request.pathname === "/__mokly/events"
      );
    }),
    [],
  );
  await fs.rm(path.join(fixture.root, ".git"), { recursive: true });
  await buildPreview(fixture.config, output);
  assert.ok(
    (await ownedEntries(output)).files.every(
      (name) => !name.startsWith("__mokly/diffs/"),
    ),
  );
});
