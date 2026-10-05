import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { serve } from "../dist/server/serve.js";
import { viewRoute } from "../packages/viewer/dist/data.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import {
  catalogue,
  version,
  waitForChangedCount,
  waitForClassifiedCount,
} from "./helpers/watched_catalogue.js";

const nestedCss =
  '@font-face { font-family: Sample; src: url("font.woff2"); } ' +
  'main { background-image: url("image.svg"); }';

test(
  "transitive resource edits update Changes and invalidate comparisons",
  { timeout: 180_000 },
  async (context) => {
    const fixture = await changedFixture(
      context,
      validEntrySource(),
      {
        extraConfig:
          'stylesheets: [{ match: "home/index.html", stylesheets: ["home.css"] }], watch: { debounceMs: 0 },',
      },
      async ({ mockupsDir }) => {
        await fs.writeFile(
          path.join(mockupsDir, "home.css"),
          '@import "nested.css";',
        );
        await fs.writeFile(path.join(mockupsDir, "nested.css"), nestedCss);
        await fs.writeFile(
          path.join(mockupsDir, "image.svg"),
          '<svg xmlns="http://www.w3.org/2000/svg"/>',
        );
        await fs.writeFile(path.join(mockupsDir, "font.woff2"), "before font");
      },
    );
    const running = await serve(fixture.config, {
      base: "main",
      port: 0,
      watch: true,
    });
    try {
      let html = await waitForClassifiedCount(running.url, 0);
      assert.match(html, /class="mbk-nav-filter-count">0</);
      let comparison = await fetch(`${running.url}/__mokly/diffs/review.json`);
      assert.equal(comparison.status, 200);
      await comparison.arrayBuffer();
      for (const [file, content] of [
        ["nested.css", `${nestedCss} main { color: red; }`],
        ["image.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="42"/>'],
        ["font.woff2", "after font"],
      ] as const) {
        const previousVersion = version(await catalogue(running.url));
        await fs.writeFile(path.join(fixture.mockupsDir, file), content);
        html = await waitForChangedCount(running.url, previousVersion, 2);
        assert.match(html, /class="mbk-nav-filter-count">2</);
        const fresh = await fetch(`${running.url}/__mokly/diffs/review.json`);
        assert.equal(fresh.status, 200);
        assert.notEqual(
          fresh.url,
          comparison.url,
          `${file} must invalidate its comparison`,
        );
        const result = (await fresh.json()) as ReviewResult;
        const view = result.screens.find((screen) => screen.path === "home")
          ?.views[0];
        assert.ok(view);
        const afterPath = `snapshots/after/${viewRoute("home", view.viewport, view.colorScheme)}`;
        const asset = await fetch(
          new URL(`../${file}`, new URL(afterPath, fresh.url)),
        );
        assert.equal(asset.status, 200);
        assert.equal(await asset.text(), content);
        comparison = fresh;
      }
    } finally {
      await running.close();
    }
  },
);
