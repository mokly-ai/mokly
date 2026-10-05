import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

function pageSource(id = "handbook"): string {
  return `${validEntrySource()}
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ path: ${JSON.stringify(id)}, title: "Handbook",
  description: "Catalogue guidance", dependencies: [], relatedDocs: [],
  render: () => "<!doctype html><html><body>Handbook</body></html>" }));`;
}

for (const includeChanges of [false, true]) {
  const options = includeChanges
    ? { includeChanges: true as const, base: "HEAD" }
    : {};
  for (const directory of ["target", "node_modules"]) {
    test(`public ${directory} ids survive publication (changes: ${includeChanges})`, async (context) => {
      const id = `${directory.replaceAll("_", "-")}-handbook`;
      const fixture = await changedFixture(context, pageSource(id));
      const output = path.join(fixture.root, ".context/published");
      await buildPreview(fixture.config, output, options);
      for (const document of [
        `${id}/index.html`,
        "home/index.mobile.html",
        "home/index.desktop.html",
      ])
        assert.equal(
          fs.existsSync(path.join(output, "static", document)),
          true,
          document,
        );
      assert.match(
        await fs.promises.readFile(
          path.join(output, "view", id, "index.html"),
          "utf8",
        ),
        /Handbook/,
      );
    });
  }

  for (const route of ["handbook/index.html", "home/index.desktop.html"]) {
    test(`publication requires the exported ${route} even if enumeration omits it (changes: ${includeChanges})`, async (context) => {
      const fixture = await changedFixture(context, pageSource());
      const output = path.join(fixture.root, ".context/published");
      await buildPreview(fixture.config, output, options);
      const before = await fs.promises.readFile(
        path.join(output, "index.html"),
      );
      const original = fs.promises.readdir;
      const omitted = path.join(fixture.mockupsDir, route);
      context.mock.method(
        fs.promises,
        "readdir",
        async (...args: Parameters<typeof original>) => {
          const entries = await original.apply(fs.promises, args);
          return String(args[0]) === path.dirname(omitted)
            ? entries.filter(
                (entry) => entry.name.toString() !== path.basename(omitted),
              )
            : entries;
        },
      );
      await assert.rejects(
        buildPreview(fixture.config, output, options),
        /exported resource/,
      );
      assert.deepEqual(
        await fs.promises.readFile(path.join(output, "index.html")),
        before,
      );
    });
  }
}
