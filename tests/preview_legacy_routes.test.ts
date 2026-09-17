import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { EXPORT_MARKER } from "../dist/export/ownership.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const includeChanges of [false, true]) {
  test(`preview migration retains valid public routes under build-directory names (changes: ${includeChanges})`, async (context) => {
    const source = `${validEntrySource()}
import { definePage } from "@mokly/mokly";
for (const directory of ["target", "node_modules"])
  mockups.push(definePage({ id: directory.replaceAll("_", "-"), title: directory, description: "A public document", dependencies: [], relatedDocs: [], route: directory + "/handbook.html", render: () => "<!doctype html><html><body>Handbook</body></html>" }));`;
    const fixture = await changedFixture(context, source);
    const output = path.join(fixture.root, ".context/published");
    const options = includeChanges
      ? { includeChanges: true as const, base: "HEAD" }
      : {};
    await buildPreview(fixture.config, output, options);
    await fs.rm(path.join(output, EXPORT_MARKER));
    await fs.rm(path.join(output, "id"), { recursive: true });
    await fs.rm(path.join(output, "__mokly/catalogue.json"));
    await buildPreview(fixture.config, output, options);
    for (const directory of ["target", "node_modules"])
      assert.match(
        await fs.readFile(
          path.join(output, "static", directory, "handbook.html"),
          "utf8",
        ),
        /Handbook/,
      );
    assert.equal(
      (await fs.stat(path.join(output, EXPORT_MARKER))).isFile(),
      true,
    );
    assert.equal(
      (await fs.stat(path.join(output, "__mokly/catalogue.json"))).isFile(),
      true,
    );
  });
}
