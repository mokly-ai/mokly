import assert from "node:assert/strict";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";

import { exportedDelivery } from "./helpers/export_delivery.js";
import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

for (const name of [
  "index.html",
  "view/screens/home.html",
  "__mokly/shell.css",
  "__mokly/client/appearance-startup.js",
  "__mokly/client/react-shell.js",
  "__mokly/navigation/delivery.js",
  "__mokly/fonts/InterVariable.woff2",
  "static/extra.txt",
]) {
  const normalizedInvariant =
    name === "__mokly/client/react-shell.js"
      ? " and preserves every normalized non-client artifact"
      : "";
  test(`deployment identity includes final ${name} bytes with unchanged comparisons${normalizedInvariant}`, async (context) => {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    const before = await exportCatalogue(fixture.config, { outDir: "site" });
    const beforeFiles = await directoryFiles(fixture.output);
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
    if (name === "__mokly/client/react-shell.js")
      assert.deepEqual(
        normalizedNonClientFiles(beforeFiles, before.deploymentId),
        normalizedNonClientFiles(files, after.deploymentId),
      );
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

function normalizedNonClientFiles(
  files: ReadonlyMap<string, Buffer>,
  deploymentId: string,
): readonly (readonly [string, Buffer])[] {
  const identity = Buffer.from(deploymentId);
  const normalized = Buffer.from("0".repeat(64));
  return [...files]
    .filter(([name]) => !name.startsWith("__mokly/client/"))
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, bytes]) => {
      const result = Buffer.from(bytes);
      for (
        let offset = result.indexOf(identity);
        offset !== -1;
        offset = result.indexOf(identity, offset + normalized.length)
      )
        normalized.copy(result, offset);
      return [name, result] as const;
    });
}

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
