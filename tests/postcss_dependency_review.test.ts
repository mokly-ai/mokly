import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { collectPostcssDependencies } from "../dist/build/styles/dependency_inventory.js";
import { loadConfig } from "../dist/config/load.js";

import { reportDuration } from "./helpers/durations.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  assertOperationScaling,
  countOperations,
  type Operation,
} from "./helpers/operation_counts.js";

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

test("missing directory diagnostics follow generated, public and missing-file checks", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const source = path.join(fixture.entriesDir, "fixture.css");
  const generated = path.join(
    fixture.mockupsDir,
    "mokly-generated/styles/old.css",
  );
  const publicFile = path.join(fixture.mockupsDir, "public.css");
  await fs.mkdir(path.dirname(generated), { recursive: true });
  await fs.writeFile(generated, ".old{}");
  await fs.writeFile(publicFile, ".public{}");
  const report = (file: string) => ({
    type: "dependency" as const,
    plugin: "fixture",
    source,
    file,
    malformed: false,
  });
  const missingDirectory = {
    type: "dir-dependency" as const,
    plugin: "fixture",
    source,
    directory: path.join(fixture.root, "absent-directory"),
    glob: "**/*",
    malformed: false,
  };
  const missingFile = report(path.join(fixture.root, "absent-file.css"));
  const first = [
    missingDirectory,
    missingFile,
    report(publicFile),
    report(generated),
  ];
  assert.throws(
    () => collectPostcssDependencies(config, first, new Set()),
    /scanned Mokly-generated output/,
  );
  assert.throws(
    () => collectPostcssDependencies(config, first.slice(0, 3), new Set()),
    /scanned a public mockups file/,
  );
  assert.throws(
    () => collectPostcssDependencies(config, first.slice(0, 2), new Set()),
    /reported a missing dependency for entries\/fixture.css: absent-file.css/,
  );
  assert.throws(
    () => collectPostcssDependencies(config, [missingDirectory], new Set()),
    /reported a missing directory dependency for entries\/fixture.css: absent-directory/,
  );
});

test(
  "Tailwind-shaped reports resolve fixed roots and sort each candidate class once at any size",
  {
    timeout: 90_000,
  },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const source = path.join(fixture.entriesDir, "fixture.css");
    const collect = async (count: number) => {
      const directory = path.join(fixture.root, `sources-${count}`);
      await fs.mkdir(directory);
      for (let start = 0; start < count; start += 500)
        await Promise.all(
          Array.from({ length: Math.min(500, count - start) }, (_, offset) =>
            fs.writeFile(
              path.join(directory, `source-${start + offset}.tsx`),
              "x",
            ),
          ),
        );
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
      const counted = await reportDuration(
        `Tailwind-shaped ${count}-file collection`,
        (text) => context.diagnostic(text),
        () =>
          countOperations(() =>
            collectPostcssDependencies(config, reports, new Set()),
          ),
      );
      assert.equal(counted.result.sourceFiles.size, count);
      context.diagnostic(
        `PostCSS collection counts: ${JSON.stringify({
          files: count,
          totals: counted.counts.totals,
          fixedRoots: {
            repository: counted.counts.byPath["fs.realpathSync.native"].get(
              config.repoRoot,
            ),
            mockups: counted.counts.byPath["fs.realpathSync.native"].get(
              config.mockupsDir,
            ),
          },
        })}`,
      );
      return counted;
    };
    const smaller = await collect(500);
    const larger = await collect(2_000);
    const scaledTotals = (
      Object.keys(smaller.counts.totals) as Operation[]
    ).filter((operation) => smaller.counts.totals[operation] > 0);
    assertOperationScaling(
      smaller,
      larger,
      [
        { operation: "fs.realpathSync.native", path: config.repoRoot },
        { operation: "fs.realpathSync.native", path: config.mockupsDir },
        { operation: "Array.prototype.sort" },
      ],
      scaledTotals,
    );
  },
);
