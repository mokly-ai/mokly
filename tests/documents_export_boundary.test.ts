import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { exportCatalogue } from "../dist/export/run.js";
import { serve } from "../dist/server/serve.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("Markdown classification keeps package-root equality export-only", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'moduleResolution: { packageRoots: ["mockups"] },',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "package.json"),
    JSON.stringify({ name: "mockups-package", type: "module", private: true }),
  );
  await fs.writeFile(path.join(fixture.mockupsDir, "notes.txt"), "Notes");
  await fs.writeFile(
    path.join(fixture.entriesDir, "guide.md"),
    "# Guide\n\n[Notes](../mockups/notes.txt)\n",
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.match(String(compilation.outputs.get("guide/index.html")), /Notes/);
  const running = await serve(config, { port: 0, watch: false });
  try {
    assert.equal((await fetch(`${running.url}/view/guide/`)).status, 200);
    const document = await fetch(
      `${running.url}/static/mokly-generated/guide/index.html`,
    );
    assert.equal(document.status, 200);
    assert.match(await document.text(), /Notes/);
  } finally {
    await running.close();
  }
  await assert.rejects(
    exportCatalogue(config, { outDir: "site", noChanges: true }),
    {
      code: "export-invalid",
      message:
        /A consumer package root must not equal mockupsDir; choose a separate public output directory\./,
    },
  );
});
