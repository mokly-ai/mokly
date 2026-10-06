import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("adding a real generated screen preserves other areas' values, classes, markup and membership", async (testContext) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-stable-"),
  );
  testContext.after(() => fs.rm(root, { recursive: true, force: true }));
  await generateLargeFixture(root, {
    areas: 2,
    screens: 2,
    rows: 1,
    stylesheets: 0,
    inlineStyles: true,
  });
  const config = await loadConfig(root);
  const before = await compileCatalogue(config);
  const entryPath = path.join(root, "specs/area-1/catalogue.mockup.tsx");
  await fs.writeFile(
    entryPath,
    (await fs.readFile(entryPath, "utf8")).replace(
      '"area-1", 2,',
      '"area-1", 3,',
    ),
  );
  const after = await compileCatalogue(config);
  for (const entry of before.manifest.entries.filter(({ path: id }) =>
    id.startsWith("area-2/"),
  ))
    for (const view of generatedViews(entry)) {
      const left = textOutput(before.outputs, view.path)!;
      const right = textOutput(after.outputs, view.path)!;
      if (entry.kind !== "page") {
        const token = JSON.stringify([
          entry.path,
          view.viewport,
          view.colorScheme,
        ]);
        const value =
          1000 +
          (createHash("sha256")
            .update(JSON.stringify(["area-2", token]), "utf8")
            .digest()
            .readUInt32BE(0) %
            1_000_000);
        assert.ok(
          left.includes(`z-index:${value}`),
          `${view.path}: exact stable hash value`,
        );
      }
      assert.equal(
        right.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, ""),
        left.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, ""),
        view.path,
      );
      const ownClasses = [...left.matchAll(/class="([^"]*)"/g)].flatMap(
        (match) => match[1]!.split(" "),
      );
      for (const className of ownClasses) {
        const rule = new RegExp(`\\.${className}\\{[^}]*\\}`, "g");
        assert.deepEqual(
          [...right.matchAll(rule)].map(([text]) => text),
          [...left.matchAll(rule)].map(([text]) => text),
          className,
        );
      }
    }
  const reader = (outputs: ReadonlyMap<string, string | Uint8Array>) => ({
    read: async (route: string) =>
      Buffer.from(
        outputs.get(route) ??
          (await fs.readFile(path.join(config.mockupsDir, route))),
      ),
  });
  const result = await classifyComponents({
    before: before.manifest,
    after: after.manifest,
    beforeReader: reader(before.outputs),
    afterReader: reader(after.outputs),
    config,
    changedPaths: ["specs/area-1/catalogue.mockup.tsx"],
    baseCommit: "a".repeat(40),
    baseRef: "main",
  });
  assert.ok(result.changes.length > 0);
  assert.ok(
    result.changes.every(
      (change) => !(change.after ?? change.before)!.path.startsWith("area-2/"),
    ),
  );
});
