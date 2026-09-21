import assert from "node:assert/strict";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";

import { exportedDelivery } from "./helpers/export_delivery.js";
import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { serveStaticFiles } from "./helpers/static_server.js";

for (const name of [
  "index.html",
  "view/screens/home.html",
  "__mokly/shell.css",
  "__mokly/client/appearance-startup.js",
  "__mokly/client/browse.js",
  "__mokly/navigation/delivery.js",
  "__mokly/fonts/InterVariable.woff2",
  "static/extra.txt",
]) {
  test(`deployment identity includes final ${name} bytes with unchanged comparisons`, async (context) => {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    const before = await exportCatalogue(fixture.config, { outDir: "site" });
    const after = await exportCatalogue(fixture.config, {
      outDir: "site",
      adapter: {
        transform: (files) => {
          files.set(
            name,
            Buffer.concat([
              Buffer.from(files.get(name) ?? ""),
              Buffer.from("\n"),
            ]),
          );
        },
      },
    });
    assert.equal(after.comparisonUrl, before.comparisonUrl);
    assert.notEqual(after.deploymentId, before.deploymentId);
    const files = await directoryFiles(fixture.output);
    for (const shell of [
      "index.html",
      "404.html",
      "view/screens/home.html",
      "id/home/index.html",
    ])
      assert.equal(
        exportedDelivery(files, shell).deploymentId,
        after.deploymentId,
      );
  });
}

test("the startup asset has a portable root or subpath export URL", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const files = await directoryFiles(fixture.output);
  const asset = "__mokly/client/appearance-startup.js";
  const expected = files.get(asset);
  assert.ok(expected, `export missing ${asset}`);

  const root = await serveStaticFiles(fixture.output);
  const subpath = await serveStaticFiles(fixture.root);
  context.after(() => root.close());
  context.after(() => subpath.close());
  for (const base of [`${root.url}/`, `${subpath.url}/site/`]) {
    const url = new URL(asset, base);
    const response = await fetch(url);
    assert.equal(response.status, 200, url.href);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  }
});

test("deployment identity covers alias edges and ignores map insertion order", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const build = (reverse: boolean, changed = false) =>
    exportCatalogue(fixture.config, {
      outDir: "site",
      adapter: {
        transform: (files) => {
          if (reverse) {
            const entries = [...files].reverse();
            files.clear();
            for (const [name, bytes] of entries) files.set(name, bytes);
          }
          const aliases = [
            ["landing", "index.html"],
            [
              "latest",
              changed ? "view/screens/details.html" : "view/screens/home.html",
            ],
          ] as const;
          return new Map(reverse ? [...aliases].reverse() : aliases);
        },
      },
    });
  const first = await build(false);
  const original = await directoryFiles(fixture.output);
  const reordered = await build(true);
  assert.match(first.deploymentId, /^[a-f0-9]{64}$/);
  assert.equal(reordered.deploymentId, first.deploymentId);
  assert.deepEqual(await directoryFiles(fixture.output), original);
  const changed = await build(true, true);
  assert.equal(changed.comparisonUrl, first.comparisonUrl);
  assert.notEqual(changed.deploymentId, first.deploymentId);
});

test("consumer lookalike descriptors are included verbatim, not stamped", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const consumer = `<html data-mokly-static="" data-mokly-delivery='{"deploymentId":"${"0".repeat(64)}"}'><body>Consumer</body></html>`;
  const result = await exportCatalogue(fixture.config, {
    outDir: "site",
    adapter: {
      transform: (files) => {
        files.set("static/consumer.html", consumer);
      },
    },
  });
  const files = await directoryFiles(fixture.output);
  assert.equal(files.get("static/consumer.html")?.toString(), consumer);
  assert.match(result.deploymentId, /^[a-f0-9]{64}$/);
  assert.notEqual(result.deploymentId, "0".repeat(64));
});
