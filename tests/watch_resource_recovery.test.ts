import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { serve } from "../dist/server/serve.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import {
  version,
  waitForChangedCount,
  waitForClassifiedCount,
} from "./helpers/watched_catalogue.js";

test(
  "new imports, missing directories, and deleted resources remain repairable",
  { timeout: 180_000 },
  async (context) => {
    const original = "main { color: red; }";
    const fixture = await changedFixture(
      context,
      validEntrySource(),
      {
        extraConfig:
          'stylesheets: [{ match: "screens/home.html", stylesheets: ["home.css"] }], watch: { debounceMs: 0 },',
      },
      async ({ mockupsDir }) => {
        await fs.writeFile(
          path.join(mockupsDir, "home.css"),
          '@import "nested.css";',
        );
        await fs.writeFile(path.join(mockupsDir, "nested.css"), original);
      },
    );
    const running = await serve(fixture.config, {
      base: "main",
      port: 0,
      watch: true,
    });
    try {
      let html = await waitForClassifiedCount(running.url, 0);
      const edit = async (action: () => Promise<void>, count?: number) => {
        const previous = version(html);
        await action();
        html = await waitForChangedCount(running.url, previous, count);
        if (count === undefined)
          assert.match(html, /data-changes-status="unavailable"/);
        else assert.ok(html.includes(`class="mbk-nav-filter-count">${count}<`));
      };
      const nested = path.join(fixture.mockupsDir, "nested.css");
      const imported = path.join(fixture.mockupsDir, "future/theme.css");
      await edit(() => fs.writeFile(nested, '@import "future/theme.css";'));
      await edit(async () => {
        await fs.mkdir(path.dirname(imported));
        await fs.writeFile(imported, "main { color: blue; }");
      }, 2);
      await edit(() => fs.writeFile(imported, "main { color: green; }"), 2);
      await edit(() => fs.rm(imported));
      await edit(() => fs.writeFile(imported, "main { color: purple; }"), 2);
      await edit(() => fs.writeFile(nested, original), 0);
      await edit(() => fs.rm(nested), 2);
      await edit(() => fs.writeFile(nested, original), 0);
    } finally {
      await running.close();
    }
  },
);

test(
  "source rebuilds and configuration changes refresh reachable resources",
  { timeout: 180_000 },
  async (context) => {
    const fixture = await changedFixture(
      context,
      validEntrySource(),
      {
        extraConfig: "watch: { debounceMs: 0 },",
      },
      async ({ mockupsDir }) => {
        await fs.writeFile(path.join(mockupsDir, "image.svg"), "<svg/>");
        await fs.writeFile(
          path.join(mockupsDir, "home.css"),
          '@import "nested.css";',
        );
        await fs.writeFile(
          path.join(mockupsDir, "nested.css"),
          "main { color: red; }",
        );
      },
    );
    const running = await serve(fixture.config, {
      base: "main",
      port: 0,
      watch: true,
    });
    try {
      let html = await waitForClassifiedCount(running.url, 0);
      const edit = async (file: string, content: string) => {
        const previous = version(html);
        await fs.writeFile(file, content);
        html = await waitForChangedCount(running.url, previous, 2);
        assert.match(html, /class="mbk-nav-filter-count">2</);
      };
      await edit(
        fixture.entryPath,
        validEntrySource({
          body: '<img src="../../image.svg" alt="Sample" />',
        }),
      );
      await edit(
        path.join(fixture.mockupsDir, "image.svg"),
        '<svg width="42"/>',
      );
      const configSource = await fs.readFile(fixture.configPath, "utf8");
      await edit(
        fixture.configPath,
        configSource.replace(
          "  entriesDir:",
          '  stylesheets: [{ match: "screens/home.html", stylesheets: ["home.css"] }],\n  entriesDir:',
        ),
      );
      await edit(
        path.join(fixture.mockupsDir, "nested.css"),
        "main { color: blue; }",
      );
    } finally {
      await running.close();
    }
  },
);
