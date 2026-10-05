import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { readCatalogue } from "@mokly/viewer";

import { exportCatalogue } from "../dist/export/run.js";
import { serve } from "../dist/server/serve.js";

import { directoryFiles } from "./helpers/export_fixture.js";
import {
  BUILD_NAMES,
  namedEntryFixture,
} from "./helpers/export_named_entries.js";
import { cliBinPath } from "./helpers/fixture.js";

for (const mode of ["committed", "derived"] as const)
  test(`${mode}: legal build-directory entry names survive every delivery boundary`, async (t) => {
    const fixture = await namedEntryFixture(t, mode);
    execFileSync(
      process.execPath,
      [
        cliBinPath,
        "check",
        "--config",
        path.join(fixture.root, "mokly.config.ts"),
      ],
      { cwd: fixture.root, stdio: "pipe" },
    );
    const server = await serve(fixture.config, {
      base: "main",
      port: 0,
      watch: false,
    });
    try {
      for (let attempt = 0; ; attempt++) {
        const response = await fetch(`${server.url}/__mokly/catalogue.json`);
        assert.equal(response.status, 200);
        const model = readCatalogue(await response.json());
        if (model.changesStatus === "ready") break;
        assert.notEqual(model.changesStatus, "unavailable");
        assert.ok(attempt < 200, "Changes did not become ready");
        await delay(50);
      }
      for (const name of BUILD_NAMES) {
        assert.equal((await fetch(`${server.url}/view/${name}/`)).status, 200);
        assert.equal(
          (await fetch(`${server.url}/static/${name}/index.mobile.html`))
            .status,
          200,
        );
      }
    } finally {
      await server.close();
    }
    const outDir = path.join(fixture.root, ".context/site");
    await exportCatalogue(fixture.config, { outDir, noChanges: true });
    await assertCurrentFiles(outDir);
    await exportCatalogue(fixture.config, { outDir, base: "main" });
    await assertCurrentFiles(outDir);
    const model = readCatalogue(
      JSON.parse(
        await fs.readFile(path.join(outDir, "__mokly/catalogue.json"), "utf8"),
      ),
    );
    assert.ok(model.comparisonUrl);
    const snapshots = path.join(outDir, path.dirname(model.comparisonUrl));
    for (const name of BUILD_NAMES) {
      for (const side of ["before", "after"])
        assert.ok(
          (
            await fs.stat(
              path.join(
                snapshots,
                `snapshots/${side}/${name}/index.mobile.html`,
              ),
            )
          ).isFile(),
        );
      for (const leaf of ["retired", "guide"])
        assert.ok(
          (
            await fs.stat(
              path.join(
                outDir,
                `view/${leaf === "guide" ? "guides" : "retired"}/${name}/index.html`,
              ),
            )
          ).isFile(),
        );
      assert.ok(
        (
          await fs.stat(
            path.join(snapshots, `previews/guides/${name}/index.json`),
          )
        ).isFile(),
      );
      assert.ok(
        (
          await fs.stat(
            path.join(snapshots, `snapshots/before/guides/${name}/index.html`),
          )
        ).isFile(),
      );
      assert.ok(
        (
          await fs.stat(
            path.join(
              snapshots,
              `snapshots/before/retired/${name}/index.mobile.html`,
            ),
          )
        ).isFile(),
      );
      assert.ok(
        (
          await fs.stat(
            path.join(
              snapshots,
              `snapshots/before/mokly-generated/assets/assets/${name}/icon.svg`,
            ),
          )
        ).isFile(),
      );
    }
    assert.ok(
      (
        await fs.stat(path.join(snapshots, "snapshots/before/public.svg"))
      ).isFile(),
    );
  });

async function assertCurrentFiles(outDir: string): Promise<void> {
  const files = await directoryFiles(outDir);
  for (const name of BUILD_NAMES) {
    assert.ok(files.has(`view/${name}/index.html`));
    assert.ok(files.has(`static/${name}/index.mobile.html`));
    assert.ok(
      files.has(`static/mokly-generated/assets/assets/${name}/icon.svg`),
    );
    assert.ok(!files.has(`static/${name}/private.json`));
  }
  assert.ok(!files.has("static/dist/unrelated/build.txt"));
}
