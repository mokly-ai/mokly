import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { compareReview } from "../dist/review/compare.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";

import { importedChangesFixture } from "./helpers/imported_changes_fixture.js";

for (const mode of ["committed", "derived"] as const) {
  for (const kind of ["plain", "module"] as const) {
    test(`${mode} ${kind} imported CSS narrows shared-impact evidence to matching views`, async (context) => {
      const fixture = await importedChangesFixture(context, mode, kind);
      await fs.appendFile(fixture.cssPath, "\n.auth { padding: 2px; }\n");
      const compilation = await compileCatalogue(fixture.config);
      if (mode === "committed")
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
        mode === "committed" ? compilation.manifest : undefined,
      );
      assert.deepEqual(
        artifact.result.screens
          .filter((screen) => screen.state === "changed")
          .map((screen) => screen.id),
        ["home"],
      );
      assert.equal(live.changedRoutes?.includes("screens/home.html"), true);
      assert.equal(live.changedRoutes?.includes("screens/details.html"), false);
      assert.ok(
        !artifact.result.sharedImpact.includes(
          `entries/${path.basename(fixture.cssPath)}`,
        ),
      );
    });
  }
  test(`${mode} changed generated font affects every view linking its stylesheet`, async (context) => {
    const fixture = await importedChangesFixture(context, mode, "asset");
    await fs.writeFile(
      path.join(fixture.entriesDir, "font.woff2"),
      Buffer.from([0, 255, 2]),
    );
    const compilation = await compileCatalogue(fixture.config);
    if (mode === "committed")
      await writeCompilation(compilation, fixture.config);
    const artifact = await compareReview(
      compilation,
      fixture.config,
      fixture.repository,
      "HEAD",
    );
    assert.equal(
      artifact.result.screens.find((screen) => screen.id === "home")?.state,
      "changed",
    );
    assert.equal(
      artifact.result.screens.find((screen) => screen.id === "details")?.state,
      "changed",
    );
    assert.equal(
      artifact.result.screens.find((screen) => screen.id === "secondary")
        ?.state,
      "unchanged",
    );
    assert.ok(!artifact.result.sharedImpact.includes("entries/font.woff2"));
    const live = await computeCatalogueChanges(
      fixture.config,
      "HEAD",
      fixture.repository,
      mode === "committed" ? compilation.manifest : undefined,
    );
    assert.equal(live.changedRoutes.includes("screens/home.html"), true);
    assert.equal(live.changedRoutes.includes("screens/details.html"), true);
    assert.equal(live.changedRoutes.includes("screens/secondary.html"), false);
    assert.ok(live.componentChanges?.comparison);
    assert.ok(
      !live.componentChanges.comparison.changedPaths.includes(
        "entries/font.woff2",
      ),
    );
  });
  test(`${mode} baseline predating imported CSS reports a one-time jump`, async (context) => {
    const fixture = await importedChangesFixture(context, mode, "new");
    await fs.writeFile(fixture.cssPath, ".auth { color: red; }");
    await fs.appendFile(fixture.entryPath, '\nimport "./theme.css";\n');
    const compilation = await compileCatalogue(fixture.config);
    if (mode === "committed")
      await writeCompilation(compilation, fixture.config);
    const artifact = await compareReview(
      compilation,
      fixture.config,
      fixture.repository,
      "HEAD",
    );
    assert.equal(
      artifact.result.screens.find((screen) => screen.id === "home")?.state,
      "changed",
    );
  });
}

test("committed Changes ignores syntactically valid stray generated output", async (context) => {
  const fixture = await importedChangesFixture(context, "committed", "plain");
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
