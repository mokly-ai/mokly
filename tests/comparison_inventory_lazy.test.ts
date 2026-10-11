import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { acceptedGenerationFromCompilation } from "../dist/review/accepted_generation.js";
import { CommittedBaselineReader } from "../dist/review/committed.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const resource of ["image.svg", "unused.css", "shared.css"]) {
  test(`complete live classification retains targeted base document reads for ${resource}`, async (t) => {
    const fixture = await cssAttributionFixture(t, false, {
      prepare: async ({ configPath }) => {
        await fs.writeFile(
          configPath,
          (await fs.readFile(configPath, "utf8")).replace(
            'match: "**/*.html"',
            'match: "home/index.html"',
          ),
        );
      },
    });
    await fixture.append("\n.auth { color: blue; }", resource);
    const config = await loadConfig(fixture.root);
    const after = await compileCatalogue(config);
    const repository = await prepareReviewRepository(config, "main");
    assert.equal(repository.selection, "blobs");
    assert.ok(repository.reader instanceof CommittedBaselineReader);
    const reads: string[] = [];
    const readFiles = repository.reader.readFiles!.bind(repository.reader);
    t.mock.method(
      repository.reader,
      "readFiles",
      (commit: string, paths: readonly string[]) => {
        reads.push(...paths);
        return readFiles(commit, paths);
      },
    );
    const result = await readCatalogueChanges(
      config,
      after.manifest,
      "main",
      repository,
      repository.commit,
      acceptedGenerationFromCompilation(after),
    );
    assert.ok(result.result);
    const documents = [
      ...new Set(reads.filter((file) => file.endsWith(".html"))),
    ].sort();
    assert.deepEqual(
      documents,
      resource === "shared.css"
        ? [
            "mockups/mokly-generated/home/index.desktop.dark.html",
            "mockups/mokly-generated/home/index.desktop.html",
            "mockups/mokly-generated/home/index.mobile.dark.html",
            "mockups/mokly-generated/home/index.mobile.html",
          ]
        : [],
    );
    assert.ok(reads.every((file) => !file.endsWith("/unused.css")));
  });
}
