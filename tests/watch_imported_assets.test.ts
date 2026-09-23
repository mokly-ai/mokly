import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readManifest } from "../dist/registry/manifest.js";
import { serve } from "../dist/server/serve.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import {
  version,
  waitForClassifiedCount,
  waitForUpdate,
} from "./helpers/watched_catalogue.js";

test(
  "editing imported image bytes rebuilds watched catalogue metadata",
  { timeout: 90_000 },
  async (context) => {
    const source =
      validEntrySource() +
      '\nimport image from "../mockups/image.svg"; mockups[1].title = "Asset " + image.length;';
    const fixture = await changedFixture(
      context,
      source,
      {
        extraConfig:
          'moduleResolution: { loaders: { ".svg": "dataurl" } }, watch: { debounceMs: 0 },',
      },
      async ({ mockupsDir }) => {
        await fs.writeFile(path.join(mockupsDir, "image.svg"), "<svg/>");
      },
    );
    const running = await serve(fixture.config, {
      base: "main",
      port: 0,
      build: true,
      watch: true,
    });
    try {
      const before = readManifest(fixture.config).entries.find(
        (entry) => entry.id === "home",
      )?.title;
      const previousVersion = version(
        await waitForClassifiedCount(running.url, 0),
      );
      await fs.writeFile(
        path.join(fixture.mockupsDir, "image.svg"),
        '<svg width="200"><rect width="20"/></svg>',
      );
      await waitForUpdate(running.url, previousVersion);
      const html = await waitForClassifiedCount(running.url, 2);
      const after = readManifest(fixture.config).entries.find(
        (entry) => entry.id === "home",
      )?.title;
      assert.ok(after);
      assert.notEqual(after, before);
      assert.ok(html.includes(after));
      assert.equal(
        (await fetch(`${running.url}/static/image.svg`)).status,
        404,
      );
    } finally {
      await running.close();
    }
  },
);
