import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { attribute, documentElements, textContent } from "./helpers/html.js";

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

test("exports contain only the hydrated shell inventory", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.promises.rm(path.join(fixture.root, ".git"), { recursive: true });
  await exportCatalogue(fixture.config, {
    outDir: "site",
    noChanges: true,
  });
  const files = await directoryFiles(fixture.output);
  assert.equal(files.has("__mokly/client/react-shell.js"), true);
  assert.match(files.get("index.html")!.toString(), /client\/react-shell\.js/);
  assert.doesNotMatch(
    files.get("index.html")!.toString(),
    /client\/(?:browse|browser)\.js/,
  );
  for (const name of [
    "host_capabilities.js",
    "host_capability_descriptor.js",
    "react-host.js",
    "react_capabilities.js",
    "react_capability_updates.js",
    "react_transports.js",
    "react_update_controller.js",
  ]) {
    assert.equal(files.has(`__mokly/client/${name}`), false, name);
  }
  assert.doesNotMatch(
    files.get("index.html")!.toString(),
    /data-mokly-host-capabilit|data-mokly-host-capability-state|react-host\.js/,
  );
  const publicCatalogue = JSON.parse(
    files.get("__mokly/catalogue.json")!.toString(),
  ) as {
    identity: { id: string };
    revision: { content: number; evidence: number };
  };
  const reference = {
    kind: "external",
    path: "/__mokly/catalogue.json",
    identity: publicCatalogue.identity.id,
    revision: publicCatalogue.revision,
  };
  const bootstraps = [...files]
    .filter(([name]) => name.endsWith(".html"))
    .flatMap(([name, bytes]) =>
      documentElements(
        bytes.toString(),
        (element) =>
          element.tagName === "script" &&
          attribute(element, "data-mokly-shell-bootstrap") !== undefined,
      ).map((script) => ({
        name,
        value: JSON.parse(textContent(script)) as {
          catalogue: Record<string, unknown>;
        },
      })),
    );
  assert.ok(bootstraps.length >= 4);
  for (const { name, value } of bootstraps) {
    assert.deepEqual(value.catalogue, reference, name);
    assert.equal("screens" in value.catalogue, false, name);
  }
  assert.deepEqual(
    [...files.keys()].filter((name) => name.endsWith("catalogue.json")),
    ["__mokly/catalogue.json"],
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
