import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectPublicCatalogue } from "../scripts/package/catalogue.mjs";

const COMPARISON = "mokly-viewer/diffs/generations/review.json";

/** A consumer whose installed viewer derives routes unlike this checkout's build. */
async function packedConsumer(t: test.TestContext) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-public-catalogue-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const viewer = path.join(root, "node_modules/@mokly/viewer");
  await fs.mkdir(path.join(viewer, "dist"), { recursive: true });
  await fs.writeFile(
    path.join(viewer, "package.json"),
    JSON.stringify({ name: "@mokly/viewer", type: "module" }),
  );
  await fs.writeFile(
    path.join(viewer, "dist/data.js"),
    [
      'export const GENERATED_DIRECTORY = "installed-generated";',
      "export const entryRoute = (entry) => `${entry}/installed.html`;",
      "export const viewRoute = (entry, viewport, scheme) =>",
      "  `${entry}/installed.${viewport}.${scheme}.html`;",
    ].join("\n"),
  );
  const artifact = path.join(root, "published");
  const write = async (relative: string, content: string) => {
    await fs.mkdir(path.dirname(path.join(artifact, relative)), {
      recursive: true,
    });
    await fs.writeFile(path.join(artifact, relative), content);
  };
  await write(
    "mokly-viewer/catalogue.json",
    JSON.stringify({
      schemaVersion: 5,
      identity: { id: "a".repeat(64) },
      deploymentId: "b".repeat(64),
      comparisonUrl: COMPARISON,
      revision: { content: 0, evidence: 0 },
      changesStatus: "ready",
      screens: [
        { path: "home", views: [{ viewport: "mobile", colorScheme: "light" }] },
      ],
      pages: [],
      documents: [],
      useCases: [],
      components: [],
    }),
  );
  await write("view/home/installed.html", "<!doctype html>");
  await write(
    "static/installed-generated/home/installed.mobile.light.html",
    "<!doctype html>",
  );
  return { artifact, root };
}

test("public catalogue checks derive routes from the installed viewer", async (t) => {
  const consumer = await packedConsumer(t);

  const model = await inspectPublicCatalogue(
    consumer.root,
    consumer.artifact,
    COMPARISON,
  );

  assert.equal((model as { schemaVersion: number }).schemaVersion, 5);
});

test("public catalogue checks reject a view missing at the installed route", async (t) => {
  const consumer = await packedConsumer(t);
  await fs.rm(
    path.join(
      consumer.artifact,
      "static/installed-generated/home/installed.mobile.light.html",
    ),
  );

  await assert.rejects(
    inspectPublicCatalogue(consumer.root, consumer.artifact, COMPARISON),
    { code: "ENOENT" },
  );
});
