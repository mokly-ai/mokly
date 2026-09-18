import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

test("current-only exports skip Git and capture exactly the installed finalized bytes", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.promises.rm(path.join(fixture.root, ".git"), { recursive: true });
  let captured: ReadonlyMap<string, string | Uint8Array> | undefined;
  const result = await exportCatalogue(fixture.config, {
    outDir: "site",
    noChanges: true,
    capture: async (files) => {
      captured = new Map(files);
    },
  });
  assert.equal(result.comparisonUrl, null);
  const files = await directoryFiles(fixture.output);
  assert.deepEqual(
    new Map([...captured!].map(([name, bytes]) => [name, Buffer.from(bytes)])),
    files,
  );
  assert.equal(
    [...files.keys()].some((name) => name.includes("/diffs/")),
    false,
  );
  assert.doesNotMatch(
    files.get("index.html")!.toString(),
    /data-filter="changed"|live_updates.js/,
  );
  assert.match(
    files.get("view/screens/home.html")!.toString(),
    /&quot;comparisonUrl&quot;:null/,
  );
});

test("the private shell selector changes only the hydration inventory", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.promises.rm(path.join(fixture.root, ".git"), { recursive: true });
  await exportCatalogue(fixture.config, {
    outDir: "vanilla-site",
    noChanges: true,
  });
  await exportCatalogue(fixture.config, {
    outDir: "react-site",
    noChanges: true,
    reactShell: true,
  });
  const vanilla = await directoryFiles(path.join(fixture.root, "vanilla-site"));
  const react = await directoryFiles(path.join(fixture.root, "react-site"));
  assert.equal(vanilla.has("__mokly/client/react-shell.js"), false);
  assert.equal(react.has("__mokly/client/react-shell.js"), true);
  assert.match(vanilla.get("index.html")!.toString(), /client\/browse\.js/);
  assert.doesNotMatch(
    vanilla.get("index.html")!.toString(),
    /client\/react-shell\.js/,
  );
  assert.match(react.get("index.html")!.toString(), /client\/react-shell\.js/);
  assert.doesNotMatch(
    react.get("index.html")!.toString(),
    /client\/(?:browse|browser)\.js/,
  );
});

test("bundle capture failure preserves the previous export transaction", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const before = await directoryFiles(fixture.output);
  await assert.rejects(
    exportCatalogue(fixture.config, {
      outDir: "site",
      noChanges: true,
      capture: async () => {
        throw new Error("bundle capture failed");
      },
    }),
    /bundle capture failed/,
  );
  assert.deepEqual(await directoryFiles(fixture.output), before);
});
