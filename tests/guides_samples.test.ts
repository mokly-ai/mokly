import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "@mokly/viewer";

import { buildStaticCatalogue } from "./helpers/build_site.js";
import { guideSamplePath } from "./helpers/guide_samples.js";
import { guideContent } from "./helpers/guides_content.js";
import { attribute, documentElements } from "./helpers/html.js";

test("guide HTML samples have front matter, avoid mock links, and build alone", async (context) => {
  const samples = guideContent().fences.flatMap((fence) => {
    const sample = guideSamplePath(fence.lang);
    return sample ? [{ ...fence, path: sample }] : [];
  });
  assert.deepEqual(
    samples.map(({ id, path }) => ({ id, path })),
    [{ id: "start/your-first-screen", path: "specs/welcome.screen.html" }],
  );
  for (const sample of samples) {
    assert.match(sample.text, /^---\n[\s\S]*?\n---(?:\n|$)/u, sample.id);
    assert.deepEqual(
      documentElements(
        sample.text,
        (element) => attribute(element, "href")?.startsWith("mock:") ?? false,
      ).map((element) => attribute(element, "href")),
      [],
      sample.id,
    );
    const root = await mkdtemp(
      path.join(os.tmpdir(), "mokly-guide-sample-test-"),
    );
    try {
      const file = path.join(root, sample.path);
      const output = path.join(root, "out");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(path.join(root, "mokly.config.json"), "{}\n");
      await writeFile(file, `${sample.text}\n`);
      await buildStaticCatalogue(root, output, context.signal);
      const value: unknown = JSON.parse(
        await readFile(path.join(output, "mokly-viewer/index.json"), "utf8"),
      );
      const catalogue = readCatalogueIndex(value);
      assert.ok(
        catalogue.screens.some(
          (screen) => screen.details.sourcePath === sample.path,
        ),
        `${sample.id}: no screen lists ${sample.path}`,
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
});
