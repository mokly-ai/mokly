import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { inspectPublicCatalogue } from "./catalogue.mjs";
import { assertOwnershipMarker, verifyOwnershipFiles } from "./ownership.mjs";
/** Inspect only the installed CLI's artifact; never import the source exporter. */
export async function inspectConsumerExport(
  root,
  relative,
  base,
  expected = [],
  schemaVersion = 5,
) {
  const output = path.join(root, relative);
  const read = (name) => fs.promises.readFile(path.join(output, name), "utf8");
  const marker = JSON.parse(await read(".mokly-export-artifact"));
  const entries = assertOwnershipMarker(marker);
  await verifyOwnershipFiles(marker, output);
  const files = entries.map(({ path: name }) => name);
  for (const name of [
    "index.html",
    "404.html",
    "__mokly/catalogue.json",
    "__mokly/client/appearance-startup.js",
    "__mokly/client/inspector.js",
    "__mokly/client/navigation-resize.js",
    "__mokly/client/react-shell.js",
    "__mokly/navigation/delivery.js",
    "__mokly/fonts/InterVariable.woff2",
    ...expected,
  ])
    assert.ok(files.includes(name), `export missing ${name}`);
  for (const name of files) {
    assert.ok(!name.split("/").includes(".."));
    assert.equal(name.startsWith("id/"), false);
    assert.equal(name.includes(".variants/"), false);
    assert.equal(
      /(?:^|\/)(?:node_modules|\.git|scripts|entries)\//.test(name),
      false,
    );
    assert.equal(/\.(?:tsx?|map)$/.test(name), false);
    assert.ok((await fs.promises.stat(path.join(output, name))).isFile());
  }
  assert.equal(files.includes("__mokly/client/react-shell.js"), true);
  for (const name of [
    "host_capabilities.js",
    "host_capability_descriptor.js",
    "react-host.js",
    "react_capabilities.js",
    "react_capability_updates.js",
    "react_transports.js",
    "react_update_controller.js",
  ])
    assert.equal(files.includes(`__mokly/client/${name}`), false);
  const home = await read("index.html");
  assert.match(home, /data-mokly-static=""/);
  assert.match(home, /client\/react-shell\.js/);
  assert.doesNotMatch(home, /client\/browser\.js/);
  assert.doesNotMatch(home, /data-mokly-host-capabilit|react-host\.js/);
  const comparison = files.find((name) =>
    /^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/.test(name),
  );
  assert.ok(comparison);
  await inspectPublicCatalogue(output, comparison);
  const review = JSON.parse(await read(comparison));
  assert.equal(review.baseRef, base);
  assert.equal(review.schemaVersion, schemaVersion);
  const { snapshotViewPath } = await import(
    pathToFileURL(path.join(root, "node_modules/@mokly/viewer/dist/data.js"))
      .href
  );
  let snapshotsChecked = 0;
  for (const entry of [
    ...review.screens.map((screen) => ({ ...screen, kind: "screen" })),
    ...(review.components ?? []).flatMap((component) =>
      component.variants.map((variant) => ({
        ...variant,
        kind: "component",
      })),
    ),
  ]) {
    for (const view of entry.views) {
      const sides =
        view.state === "added"
          ? ["after"]
          : view.state === "removed"
            ? ["before"]
            : ["before", "after"];
      for (const side of sides) {
        const snapshot = snapshotViewPath(
          side,
          entry.path,
          view.viewport,
          view.colorScheme,
        );
        snapshotsChecked++;
        assert.ok(
          files.includes(
            path.posix.join(path.posix.dirname(comparison), snapshot),
          ),
        );
      }
    }
  }
  assert.ok(snapshotsChecked > 0, "export inspection checked no snapshots");
  return review;
}
