import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { collectPostcssDependencies } from "../dist/build/styles/dependency_inventory.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("public PostCSS dependency diagnostics precede missing-file diagnostics", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const publicFile = path.join(fixture.mockupsDir, "z-public.css");
  await fs.writeFile(publicFile, ".public{}");
  const config = await loadConfig(fixture.root);
  const source = path.join(fixture.entriesDir, "fixture.css");
  const report = (file: string) => ({
    type: "dependency" as const,
    plugin: "fixture",
    source,
    file,
    malformed: false,
  });
  assert.throws(
    () =>
      collectPostcssDependencies(
        config,
        [
          report(path.join(fixture.entriesDir, "a-missing.css")),
          report(publicFile),
        ],
        new Set(),
      ),
    /PostCSS plugin fixture scanned a public mockups file in entries\/fixture.css: mockups\/z-public.css/,
  );
});

test(
  "Tailwind-shaped 20,000-file reports classify without repeated sort or root projection",
  {
    timeout: 90_000,
  },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const directory = path.join(fixture.root, "sources");
    await fs.mkdir(directory);
    const count = 20_000;
    for (let start = 0; start < count; start += 500)
      await Promise.all(
        Array.from({ length: 500 }, (_, offset) =>
          fs.writeFile(
            path.join(directory, `source-${start + offset}.tsx`),
            "x",
          ),
        ),
      );
    const config = await loadConfig(fixture.root);
    const source = path.join(fixture.entriesDir, "fixture.css");
    const reports = [
      ...Array.from({ length: count }, (_, index) => ({
        type: "dependency" as const,
        plugin: "tailwind-shape",
        source,
        file: path.join(directory, `source-${index}.tsx`),
        malformed: false,
      })),
      {
        type: "dir-dependency" as const,
        plugin: "tailwind-shape",
        source,
        directory,
        glob: "*.tsx",
        malformed: false,
      },
    ];
    const started = performance.now();
    const inventory = collectPostcssDependencies(config, reports, new Set());
    const elapsed = performance.now() - started;
    context.diagnostic(
      `Tailwind-shaped 20,000-file collection: ${elapsed.toFixed(1)} ms`,
    );
    assert.equal(inventory.sourceFiles.size, count);
    assert.ok(elapsed < 2_500, `20,000 reports took ${elapsed.toFixed(1)} ms`);
  },
);
