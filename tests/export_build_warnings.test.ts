import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { BuildDiagnostic } from "../dist/build/build_warnings.js";
import { enforceStrictBuildWarnings } from "../dist/build/build_warnings.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { MoklyError } from "../dist/errors.js";
import { exportCatalogue } from "../dist/export/run.js";

import { createExportFixture } from "./helpers/export_fixture.js";

const warning: BuildDiagnostic = {
  code: "link-control-ancestor",
  route: "screens/home.desktop.html",
  message: "MockLink child control is inside <button>",
};

test("export reports its primary compilation before staging and strict leaves output absent", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  const compilation = await compileCatalogue(fixture.config);
  const reported: BuildDiagnostic[][] = [];

  await assert.rejects(
    exportCatalogue(
      fixture.config,
      {
        outDir: "strict-site",
        noChanges: true,
        onBuildDiagnostics(diagnostics) {
          reported.push([...diagnostics]);
          enforceStrictBuildWarnings(diagnostics, true);
        },
      },
      {
        compile: async () => ({ ...compilation, diagnostics: [warning] }),
      },
    ),
    (error: unknown) =>
      error instanceof MoklyError && error.code === "build-invalid",
  );

  assert.deepEqual(reported, [[warning]]);
  assert.equal(fs.existsSync(path.join(fixture.root, "strict-site")), false);
});

test("export reports only its primary compilation, not the freshness compilation", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  const reported: BuildDiagnostic[][] = [];

  await exportCatalogue(fixture.config, {
    outDir: "site",
    noChanges: true,
    onBuildDiagnostics: (diagnostics) => reported.push([...diagnostics]),
  });

  assert.deepEqual(reported, [[]]);
});
