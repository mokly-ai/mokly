import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createCatalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../dist/browse/document_adapter.js";
import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { packageOwnedPath } from "../dist/build/package_owned_paths.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { assertExportOwnership } from "../dist/export/ownership.js";
import { normalizeReviewPair } from "../dist/review/ignore.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

for (const format of ["plain-mokly", "plain-mokabook", "encoded-mokabook"])
  test(`earlier ${format} comments remain ordinary authored bytes`, async (t) => {
    const sample = await fs.readFile(
      path.join(
        repositoryRoot,
        `tests/fixtures/earlier-ownership/${format}.html`,
      ),
      "utf8",
    );
    const fixture = await createExportFixture();
    t.after(() => fixture.close());
    const compilation = await compileCatalogue(fixture.config);
    const authored = path.join(fixture.mockupsDir, "earlier.html");
    await fs.writeFile(authored, sample);
    assert.equal(packageOwnedPath(authored, fixture.config), undefined);
    for (const bytes of [sample, sample.replaceAll("\n", "\r\n")]) {
      const body = bytes.slice(bytes.indexOf("\n") + 1);
      assert.notEqual(
        normalizeReviewPair(bytes, body, "earlier.html").base,
        body,
      );
      assert.equal(
        adaptBrowseDocument(
          bytes,
          undefined,
          createCatalogue(compilation.manifest),
        ),
        bytes,
      );
    }
    await writeCompilation(compilation, fixture.config);
    assert.doesNotThrow(() => checkCompilation(compilation, fixture.config));
    assert.equal(await fs.readFile(authored, "utf8"), sample);
    const route = "home/index.mobile.html";
    const generated = path.join(fixture.config.generatedDir, route);
    await fs.writeFile(generated, sample);
    assert.throws(
      () => checkCompilation(compilation, fixture.config),
      /stale generated files/,
    );
    await writeCompilation(compilation, fixture.config);
    assert.equal(
      await fs.readFile(generated, "utf8"),
      compilation.outputs.get(route),
    );
    assert.equal(await fs.readFile(authored, "utf8"), sample);
    const output = path.join(fixture.root, "unowned-export");
    await fs.mkdir(output);
    await fs.writeFile(path.join(output, "index.html"), sample);
    await assert.rejects(assertExportOwnership(output), /ownership is missing/);
    assert.equal(
      await fs.readFile(path.join(output, "index.html"), "utf8"),
      sample,
    );
  });
