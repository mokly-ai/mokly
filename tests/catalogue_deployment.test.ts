import assert from "node:assert/strict";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { canonicalJson } from "../packages/viewer/dist/components/data.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

test("catalogue identity normalizes only its owned top-level field and hashes other data", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  const first = await exportCatalogue(fixture.config, {
    outDir: "site",
    noChanges: true,
  });
  const build = (extension: boolean) =>
    exportCatalogue(fixture.config, {
      outDir: "site",
      noChanges: true,
      adapter: {
        transform(files) {
          const model = JSON.parse(
            Buffer.from(files.get("__mokly/catalogue.json")!).toString(),
          );
          model.deploymentId = "b".repeat(64);
          if (extension) model.extension = { deploymentId: "c".repeat(64) };
          files.set("__mokly/catalogue.json", canonicalJson(model, 2));
        },
      },
    });
  assert.equal((await build(false)).deploymentId, first.deploymentId);
  const extended = await build(true);
  assert.notEqual(extended.deploymentId, first.deploymentId);
  const model = JSON.parse(
    (await directoryFiles(fixture.output))
      .get("__mokly/catalogue.json")!
      .toString(),
  );
  assert.equal(model.deploymentId, extended.deploymentId);
  assert.equal(model.extension.deploymentId, "c".repeat(64));
});

for (const alteration of [
  "missing",
  "malformed",
  "private",
  "collision",
  "prefix",
] as const) {
  test(`catalogue ${alteration} aborts before replacing an export`, async (t) => {
    const fixture = await createExportFixture();
    t.after(() => fixture.close());
    await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
    const previous = await directoryFiles(fixture.output);
    await assert.rejects(
      exportCatalogue(fixture.config, {
        outDir: "site",
        noChanges: true,
        adapter: {
          transform(files) {
            if (alteration === "missing")
              files.delete("__mokly/catalogue.json");
            else if (alteration === "collision")
              files.set("__mokly/CATALOGUE.json", "{}");
            else if (alteration === "prefix")
              files.set("__mokly/catalogue.json/child", "{}");
            else {
              const model = JSON.parse(
                Buffer.from(files.get("__mokly/catalogue.json")!).toString(),
              );
              if (alteration === "malformed") model.deploymentId = "invalid";
              else model.sourceFiles = ["entries/secret.tsx"];
              files.set("__mokly/catalogue.json", JSON.stringify(model));
            }
          },
        },
      }),
    );
    assert.deepEqual(await directoryFiles(fixture.output), previous);
  });
}
