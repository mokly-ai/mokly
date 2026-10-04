import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createCatalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../dist/browse/document_adapter.js";
import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import {
  generatedSource,
  hasGeneratedOwnershipHeader,
  isOwned,
  pendingGeneratedOrphanRoutes,
  unclaimedGeneratedRoutes,
} from "../dist/build/ownership.js";
import { packageOwnedPath } from "../dist/build/package_owned_paths.js";
import { GitTrackedGeneratedOutput } from "../dist/build/tracked_output.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { ConfiguredGitCommandRunner } from "../dist/config/git.js";
import { assertExportOwnership } from "../dist/export/ownership.js";
import { normalizeReviewPair } from "../dist/review/ignore.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

for (const format of ["plain-mokly", "plain-mokabook", "encoded-mokabook"])
  test(`earlier ${format} output grants no ownership at any HTML consumer`, async (t) => {
    const sample = await fs.readFile(
      path.join(
        repositoryRoot,
        `tests/fixtures/earlier-ownership/${format}.html`,
      ),
      "utf8",
    );
    for (const bytes of [sample, sample.replaceAll("\n", "\r\n")]) {
      assert.equal(generatedSource(bytes), undefined);
      assert.equal(
        hasGeneratedOwnershipHeader(bytes, "entries/fixture.mockup.tsx"),
        false,
      );
    }
    const fixture = await createExportFixture();
    t.after(() => fixture.close());
    const compilation = await compileCatalogue(fixture.config);
    const orphan = path.join(fixture.mockupsDir, "earlier.html");
    await fs.writeFile(orphan, sample);
    assert.equal(isOwned(orphan, fixture.config), false);
    assert.equal(packageOwnedPath(orphan, fixture.config), undefined);
    const withoutHeader = sample.slice(sample.indexOf("\n") + 1);
    assert.notEqual(
      normalizeReviewPair(sample, withoutHeader, "earlier.html").base,
      withoutHeader,
    );
    assert.ok(
      !pendingGeneratedOrphanRoutes(
        fixture.config,
        compilation.outputs.keys(),
      ).includes("earlier.html"),
    );
    assert.ok(
      !unclaimedGeneratedRoutes(fixture.config).includes("earlier.html"),
    );
    assert.doesNotThrow(() => checkCompilation(compilation, fixture.config));
    await writeCompilation(compilation, fixture.config);
    assert.equal(await fs.readFile(orphan, "utf8"), sample);
    await fixture.git("add", "mockups/earlier.html");
    const owned = new GitTrackedGeneratedOutput(
      new ConfiguredGitCommandRunner(fixture.config),
    );
    await fixture.git(
      "rm",
      "--cached",
      "-r",
      "mockups/home",
      "mockups/details",
      "mockups/mokly-manifest.json",
    );
    await owned.check(compilation, {
      ...fixture.config,
      generatedOutput: "derived",
    });
    const route = "home/index.mobile.html";
    const current = path.join(fixture.mockupsDir, route);
    await fs.writeFile(current, sample);
    assert.throws(
      () => checkCompilation(compilation, fixture.config),
      /stale generated files:\n {2}- home\/index.mobile.html/,
    );
    await assert.rejects(
      writeCompilation(compilation, fixture.config),
      /has no valid generated ownership header/,
    );
    assert.equal(await fs.readFile(current, "utf8"), sample);
    assert.throws(
      () =>
        adaptBrowseDocument(
          sample,
          route,
          createCatalogue(compilation.manifest),
        ),
      /missing or mismatched ownership header/,
    );
    const output = path.join(fixture.root, "unowned-export");
    await fs.mkdir(output);
    await fs.writeFile(path.join(output, "index.html"), sample);
    await assert.rejects(assertExportOwnership(output), /ownership is missing/);
    assert.equal(
      await fs.readFile(path.join(output, "index.html"), "utf8"),
      sample,
    );
  });
