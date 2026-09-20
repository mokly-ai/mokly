import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { extract } from "tar-stream";

import { readCatalogue } from "@mokly/viewer";
import { parseRemovedPagePreview } from "@mokly/viewer/data";

import {
  EXPORT_MARKER,
  ownedEntries,
  parseExportOwnership,
} from "../dist/export/ownership.js";
import { exportCatalogue } from "../dist/export/run.js";
import { bundleUpload } from "../dist/publish/bundle.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { assertPublishedPagePreview } from "./helpers/published_preview.js";
import { createRemovedDeliveryFixture } from "./helpers/removed_delivery_fixture.js";

test("Changes export packages removed previews into every delivery boundary", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  let captured = new Map<string, Buffer>();
  const result = await exportCatalogue(fixture.config, {
    base: "origin/main",
    outDir: "site",
    capture: async (files) => {
      captured = new Map(
        [...files].map(([name, bytes]) => [name, Buffer.from(bytes)]),
      );
    },
  });
  assert.ok(result.comparisonUrl);
  const model = readCatalogue(
    JSON.parse(
      await fs.readFile(
        path.join(fixture.output, "__mokly/catalogue.json"),
        "utf8",
      ),
    ),
  );
  const page = model.removedEntries.find(
    ({ entry }) => entry.route === "archive/removed.html",
  );
  const screen = model.removedEntries.find(
    ({ entry }) => entry.route === "screens/removed.html",
  );
  assert.deepEqual(screen?.preview, { kind: "screen" });
  assert.ok(page?.preview?.kind === "page");
  const pagePath = page.preview.path;
  const generationRoot = path.posix.dirname(
    path.posix.dirname(path.posix.dirname(pagePath)),
  );
  assert.equal(pagePath, `${generationRoot}/pages/archive/removed.html.json`);
  const preview = parseRemovedPagePreview(
    JSON.parse(await fs.readFile(path.join(fixture.output, pagePath), "utf8")),
  );
  assert.equal(preview.baseCommit, fixture.baseCommit);
  assert.equal(preview.documentPath, "snapshots/before/archive/removed.html");
  for (const name of [
    pagePath,
    `${generationRoot}/snapshots/before/archive/removed.html`,
    `${generationRoot}/snapshots/before/assets/page.css`,
    `${generationRoot}/snapshots/before/assets/nested.css`,
    `${generationRoot}/snapshots/before/assets/past.png`,
  ]) {
    assert.ok(captured.has(name), name);
    await fs.access(path.join(fixture.output, name));
  }
  assert.deepEqual(
    await fs.readFile(
      path.join(
        fixture.output,
        `${generationRoot}/snapshots/before/assets/past.png`,
      ),
    ),
    Buffer.from([0, 17, 34, 51, 68]),
  );
  const ownership = parseExportOwnership(
    await fs.readFile(path.join(fixture.output, EXPORT_MARKER), "utf8"),
  );
  assert.ok(ownership?.files.includes(pagePath));
  assert.ok(
    ownership?.files.includes(
      `${generationRoot}/snapshots/before/assets/past.png`,
    ),
  );
  const archived = await archiveNames(await bundleUpload(captured));
  assert.ok(archived.has(pagePath));
  assert.ok(archived.has(`${generationRoot}/snapshots/before/assets/past.png`));
});

test("current-only export replaces Changes without Git or historical files", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  await exportCatalogue(fixture.config, {
    base: "origin/main",
    outDir: "site",
  });
  await fs.rm(path.join(fixture.root, ".git"), { recursive: true });
  const result = await exportCatalogue(fixture.config, {
    noChanges: true,
    outDir: "site",
  });
  assert.equal(result.comparisonUrl, null);
  assert.ok(
    (await ownedEntries(fixture.output)).files.every(
      (name) => !name.startsWith("__mokly/diffs/"),
    ),
  );
  const model = readCatalogue(
    JSON.parse(
      await fs.readFile(
        path.join(fixture.output, "__mokly/catalogue.json"),
        "utf8",
      ),
    ),
  );
  assert.equal(model.comparisonUrl, null);
  assert.deepEqual(model.removedEntries, []);
});

test("an incomplete page closure preserves the previous export", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  await exportCatalogue(fixture.config, {
    noChanges: true,
    outDir: "site",
  });
  const previous = await readArtifact(fixture.output);
  await fixture.git(
    "rm",
    "--cached",
    "--ignore-unmatch",
    "mockups/assets/nested.css",
  );
  await fixture.git("commit", "-qm", "test: break historical closure");
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await assert.rejects(
    exportCatalogue(fixture.config, {
      base: "origin/main",
      outDir: "site",
    }),
    /unavailable|resource|snapshot/i,
  );
  assert.deepEqual(await readArtifact(fixture.output), previous);
});

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
    ({ entry }) => entry.route === "archive/removed.html",
  );
  assert.ok(page?.preview?.kind === "page");
  await assertPublishedPagePreview(output, page.preview);
  await fs.access(path.join(output, "__mokly/client/previews.js"));
  await fs.access(path.join(output, page.preview.path));
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

async function archiveNames(compressed: Buffer): Promise<ReadonlySet<string>> {
  const unpack = extract();
  const names = new Set<string>();
  unpack.on("entry", (header, stream, next) => {
    names.add(header.name);
    stream.on("end", next);
    stream.resume();
  });
  await pipeline(Readable.from([gunzipSync(compressed)]), unpack);
  return names;
}

async function readArtifact(
  root: string,
): Promise<ReadonlyMap<string, Buffer>> {
  const entries = await ownedEntries(root);
  return new Map(
    await Promise.all(
      entries.files.map(
        async (name) =>
          [name, await fs.readFile(path.join(root, name))] as const,
      ),
    ),
  );
}
