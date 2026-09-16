import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { inspectPublicCatalogue } from "./catalogue.mjs";
/** Inspect only the installed CLI's artifact; never import the source exporter. */
export async function inspectConsumerExport(
  root,
  relative,
  base,
  expected = [],
  schemaVersion = 2,
) {
  const output = path.join(root, relative);
  const read = (name) => fs.promises.readFile(path.join(output, name), "utf8");
  const marker = JSON.parse(await read(".mokly-export-artifact"));
  assert.equal(marker.schemaVersion, 1);
  for (const name of [
    "index.html",
    "404.html",
    "__mokly/catalogue.json",
    "__mokly/client/inspector.js",
    "__mokly/client/browse.js",
    "__mokly/client/static_delivery.js",
    "__mokly/navigation/delivery.js",
    "__mokly/fonts/InterVariable.woff2",
    ...expected,
  ])
    assert.ok(marker.files.includes(name), `export missing ${name}`);
  for (const name of marker.files) {
    assert.ok(!name.split("/").includes(".."));
    assert.equal(
      /(?:^|\/)(?:node_modules|\.git|scripts|entries)\//.test(name),
      false,
    );
    assert.equal(/\.(?:tsx?|map)$/.test(name), false);
    assert.ok((await fs.promises.stat(path.join(output, name))).isFile());
  }
  const home = await read("index.html");
  assert.match(home, /data-mokly-static=""/);
  assert.doesNotMatch(home, /client\/browser\.js/);
  const comparison = marker.files.find((name) =>
    /^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/.test(name),
  );
  assert.ok(comparison);
  await inspectPublicCatalogue(output, comparison);
  const review = JSON.parse(await read(comparison));
  assert.equal(review.baseRef, base);
  assert.equal(review.schemaVersion, schemaVersion);
  for (const screen of [
    ...review.screens,
    ...(review.components ?? []).flatMap((component) => component.variants),
  ]) {
    for (const view of screen.views) {
      for (const snapshot of [view.beforePath, view.afterPath].filter(Boolean))
        assert.ok(
          marker.files.includes(
            path.posix.join(path.posix.dirname(comparison), snapshot),
          ),
        );
    }
  }
  return review;
}
