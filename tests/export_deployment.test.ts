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
  "view/home/index.html",
  "__mokly/shell.css",
  "__mokly/client/appearance-startup.js",
  "__mokly/client/react-shell.js",
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
    for (const shell of ["index.html", "404.html", "view/home/index.html"])
      assert.equal(
        exportedDelivery(files, shell).deploymentId,
        after.deploymentId,
      );
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
              changed ? "view/details/index.html" : "view/home/index.html",
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

test("publish manifest revisions leave identity, every shell and catalogue unchanged", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const baseManifest = {
    schemaVersion: 1,
    moklyVersion: "1.2.3",
    repository: { host: "example.com", owner: "team", name: "catalogue" },
    branch: "main",
    baseRef: null,
    baseSha: null,
    pullRequest: null,
    configPath: "mokly.config.ts",
    comparisonPath: null,
  };
  const build = async (headSha: string, exportedAt: string) => {
    const result = await exportCatalogue(fixture.config, {
      outDir: "site",
      noChanges: true,
      adapter: {
        publicationMetadata: ["mokly-upload.json"],
        transform(files) {
          files.set(
            "mokly-upload.json",
            `${JSON.stringify({ ...baseManifest, headSha, exportedAt })}\n`,
          );
        },
      },
    });
    return { result, files: await directoryFiles(fixture.output) };
  };
  const first = await build("a".repeat(40), "2026-09-26T12:00:00.000Z");
  const second = await build("b".repeat(40), "2026-09-26T13:00:00.000Z");
  assert.equal(second.result.deploymentId, first.result.deploymentId);
  const stable = [...first.files.keys()].filter(
    (name) =>
      name === "index.html" ||
      name === "404.html" ||
      name === "__mokly/catalogue.json" ||
      name.startsWith("view/") ||
      (name.startsWith("id/") && name.endsWith("/index.html")),
  );
  assert.ok(stable.length > 5);
  for (const name of stable)
    assert.deepEqual(second.files.get(name), first.files.get(name), name);
  assert.notDeepEqual(
    second.files.get("mokly-upload.json"),
    first.files.get("mokly-upload.json"),
  );
  assert.notDeepEqual(
    second.files.get(".mokly-export-artifact"),
    first.files.get(".mokly-export-artifact"),
  );
});

test("publication metadata declarations must name new root files", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  for (const adapter of [
    {
      publicationMetadata: ["missing.json"],
      transform() {},
    },
    {
      publicationMetadata: ["index.html"],
      transform(files: Map<string, string | Uint8Array>) {
        files.set("index.html", "Replaced shell");
      },
    },
    {
      publicationMetadata: ["__mokly/catalogue.json"],
      transform() {},
    },
    {
      publicationMetadata: ["nested/publication.json"],
      transform(files: Map<string, string | Uint8Array>) {
        files.set("nested/publication.json", "Nested metadata");
      },
    },
  ])
    await assert.rejects(
      exportCatalogue(fixture.config, {
        outDir: "site",
        noChanges: true,
        adapter,
      }),
      /export-invalid/u,
    );
});
