import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { EXPORT_MARKER } from "../dist/export/ownership.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const includeChanges of [false, true]) {
  test(`preview republishes paths that match build-directory names (changes: ${includeChanges})`, async (context) => {
    const source = `${validEntrySource()}
import { definePage } from "@mokly/mokly";
for (const directory of ["target", "node_modules"])
  mockups.push(definePage({ path: directory.replaceAll("_", "-"), title: directory, description: "A public document", dependencies: [], relatedDocs: [], render: () => "<!doctype html><html><body>Handbook</body></html>" }));`;
    const fixture = await changedFixture(context, source);
    const output = path.join(fixture.root, ".context/published");
    const options = includeChanges
      ? { includeChanges: true as const, base: "HEAD" }
      : {};
    await buildPreview(fixture.config, output, options);
    await buildPreview(fixture.config, output, options);
    for (const id of ["target", "node-modules"])
      assert.match(
        await fs.readFile(path.join(output, "view", id, "index.html"), "utf8"),
        new RegExp(`data-entry-id="${id}"`),
      );
    for (const id of ["target", "node-modules"])
      assert.match(
        await fs.readFile(
          path.join(output, "static/mokly-generated", id, "index.html"),
          "utf8",
        ),
        /Handbook/,
      );
    assert.equal(
      (await fs.stat(path.join(output, EXPORT_MARKER))).isFile(),
      true,
    );
    assert.equal(
      (
        await fs.stat(path.join(output, "mokly-viewer/catalogue.json"))
      ).isFile(),
      true,
    );
  });
}
