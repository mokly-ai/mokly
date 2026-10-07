import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import * as data from "@mokly/viewer/data";

import { assetRoute, stylesheetRoute } from "../dist/build/styles/routes.js";
import { CATALOGUE_PATH } from "../dist/catalogue/serialization.js";
import {
  assertExportOwnership,
  buildExportOwnership,
  EXPORT_MARKER,
  parseExportOwnership,
} from "../dist/export/ownership.js";
import { statusError } from "../dist/publish/errors.js";
import { validateUploadManifest } from "../dist/publish/manifest.js";
import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
  loadShellFontAssets,
} from "../dist/server/client_modules.js";
import { DIFF_ROUTE, GENERATION_ROUTE } from "../dist/server/review_urls.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("fixed deployed names use the portable viewer namespace", () => {
  assert.equal(data.VIEWER_DIRECTORY, "mokly-viewer");
  assert.equal(CATALOGUE_PATH, "mokly-viewer/catalogue.json");
  assert.equal(DIFF_ROUTE, "/mokly-viewer/diffs/");
  assert.equal(GENERATION_ROUTE, "/mokly-viewer/diffs/generations/");
  const names = [
    data.GENERATED_DIRECTORY,
    data.VIEWER_DIRECTORY,
    CATALOGUE_PATH,
    GENERATION_ROUTE.slice(1),
    "static",
    "view",
    "pages",
    "screens",
    "components",
    "user-flows",
    "styles",
    "assets",
    "client",
    "shell.css",
    "fonts",
    "navigation",
    "views",
    "events",
    "renders",
    "render",
    "snapshots/before",
    "snapshots/after",
    "review.json",
    "index.html",
    "404.html",
    "mokly-upload.json",
    "InterVariable.woff2",
    stylesheetRoute("/repository/entry.mockup.tsx", "/repository"),
    assetRoute("/repository/image.png", "/repository"),
    data.snapshotSidePath("before"),
    data.snapshotSidePath("after"),
    ...loadBrowserClientModules().keys(),
    ...loadBrowserNavigationModules().keys(),
    ...loadShellFontAssets().keys(),
  ];
  for (const name of names)
    for (const segment of name.split("/").filter(Boolean))
      assert.doesNotMatch(segment, /^[._#~]/u, name);
});

test("ownership v3 rejects old and unknown versions before file validation", () => {
  assert.equal(buildExportOwnership(new Map()).schemaVersion, 3);
  for (const schemaVersion of [0, 1, 2, 4, "3"])
    assert.deepEqual(
      parseExportOwnership(JSON.stringify({ schemaVersion, files: [null] })),
      { kind: "unsupported-version", version: schemaVersion },
    );
});

test("the namespace policy adds no rejection of user-chosen path segments", () => {
  const files = new Map([
    ["static/_authored.css", "body{}"],
    ["static/mokly-generated/styles/_source/screen.mockup.tsx.css", "body{}"],
    ["static/mokly-generated/assets/_source/logo.png", "bytes"],
    ["view/screens/_identity.html", "<main>Screen</main>"],
  ]);
  assert.equal(
    parseExportOwnership(JSON.stringify(buildExportOwnership(files))).kind,
    "valid",
  );
});

test("old export markers fail before mutation with the current ownership error", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "site");
  await fs.mkdir(output);
  const marker = JSON.stringify({ schemaVersion: 2, files: [] });
  await fs.writeFile(path.join(output, EXPORT_MARKER), marker);
  await assert.rejects(assertExportOwnership(output), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(
      error.message,
      `[mokly/export-invalid] Invalid export ownership inventory: ${output}.`,
    );
    return true;
  });
  assert.equal(
    await fs.readFile(path.join(output, EXPORT_MARKER), "utf8"),
    marker,
  );
});

test("upload rejects older versions before reading metadata", () => {
  for (const schemaVersion of [0, 1, 3])
    assert.throws(
      () =>
        validateUploadManifest({
          schemaVersion,
          get repository(): never {
            throw new Error("Unexpected metadata read");
          },
        }),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "upload-unsupported-version",
    );
});

test("an old service has the approved version diagnostic", () => {
  assert.equal(
    statusError(426).message,
    "[mokly/upload-unsupported-version] The catalogue service does not support this Mokly version. Update the service and try again.",
  );
});
