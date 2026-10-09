import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { compareReview } from "../dist/review/compare.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";

import { importedChangesFixture } from "./helpers/imported_changes_fixture.js";

for (const storage of ["blobs", "rebuild"] as const) {
  for (const kind of ["plain", "module"] as const) {
    test(`${storage} ${kind} imported CSS narrows shared-impact evidence to matching views`, async (context) => {
      const fixture = await importedChangesFixture(context, storage, kind);
      await fs.appendFile(fixture.cssPath, "\n.auth { padding: 2px; }\n");
      const compilation = await compileCatalogue(fixture.config);
      if (storage === "blobs")
        await writeCompilation(compilation, fixture.config);
      const artifact = await compareReview(
        compilation,
        fixture.config,
        fixture.repository,
        "HEAD",
      );
      const live = await computeCatalogueChanges(
        fixture.config,
        "HEAD",
        fixture.repository,
        storage === "blobs" ? compilation.manifest : undefined,
      );
      assert.deepEqual(
        artifact.result.screens
          .filter((screen) => screen.state === "changed")
          .map((screen) => screen.path),
        ["home"],
      );
      assert.equal(live.changedEntries?.includes("home"), true);
      assert.equal(live.changedEntries?.includes("details"), false);
      assert.equal(Object.hasOwn(artifact.result, "sharedImpact"), false);
    });
  }
  test(`${storage} changed generated font affects every view linking its stylesheet`, async (context) => {
    const fixture = await importedChangesFixture(context, storage, "asset");
    await fs.writeFile(
      path.join(fixture.entriesDir, "font.woff2"),
      Buffer.from([0, 255, 2]),
    );
    const compilation = await compileCatalogue(fixture.config);
    if (storage === "blobs")
      await writeCompilation(compilation, fixture.config);
    const artifact = await compareReview(
      compilation,
      fixture.config,
      fixture.repository,
      "HEAD",
    );
    assert.equal(
      artifact.result.screens.find((screen) => screen.path === "home")?.state,
      "changed",
    );
    assert.equal(
      artifact.result.screens.find((screen) => screen.path === "details")
        ?.state,
      "changed",
    );
    assert.equal(
      artifact.result.screens.find((screen) => screen.path === "secondary")
        ?.state,
      "unchanged",
    );
    assert.equal(Object.hasOwn(artifact.result, "sharedImpact"), false);
    const live = await computeCatalogueChanges(
      fixture.config,
      "HEAD",
      fixture.repository,
      storage === "blobs" ? compilation.manifest : undefined,
    );
    assert.equal(live.changedEntries.includes("home"), true);
    assert.equal(live.changedEntries.includes("details"), true);
    assert.equal(live.changedEntries.includes("secondary"), false);
    assert.ok(live.componentChanges?.comparison);
    assert.ok(
      !live.componentChanges.comparison.changedPaths.includes(
        "entries/font.woff2",
      ),
    );
  });
  test(`${storage} baseline predating imported CSS reports a one-time jump`, async (context) => {
    const fixture = await importedChangesFixture(context, storage, "new");
    await fs.writeFile(fixture.cssPath, ".auth { color: red; }");
    await fs.appendFile(fixture.entryPath, '\nimport "./theme.css";\n');
    const compilation = await compileCatalogue(fixture.config);
    if (storage === "blobs")
      await writeCompilation(compilation, fixture.config);
    const artifact = await compareReview(
      compilation,
      fixture.config,
      fixture.repository,
      "HEAD",
    );
    assert.equal(
      artifact.result.screens.find((screen) => screen.path === "home")?.state,
      "changed",
    );
  });
}

test("Git-blob Changes ignores syntactically valid stray generated output", async (context) => {
  const fixture = await importedChangesFixture(context, "blobs", "plain");
  const route = "mokly-generated/styles/stray.css";
  await fs.mkdir(path.join(fixture.mockupsDir, "mokly-generated/styles"), {
    recursive: true,
  });
  await fs.writeFile(path.join(fixture.mockupsDir, route), ".stray {}");
  const changes = await computeCatalogueChanges(
    fixture.config,
    "HEAD",
    fixture.repository,
  );
  assert.ok(
    !changes.componentChanges?.comparison?.changedPaths.includes(
      `mockups/${route}`,
    ),
  );
});
