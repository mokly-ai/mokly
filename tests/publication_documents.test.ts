import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

function pageSource(route: string): string {
  return `${validEntrySource()}
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ id: "handbook", title: "Handbook", route: ${JSON.stringify(route)},
  description: "Catalogue guidance", dependencies: [], relatedDocs: [],
  render: () => "<!doctype html><html><body>Handbook</body></html>" }));`;
}

for (const includeChanges of [false, true]) {
  const options = includeChanges
    ? { includeChanges: true as const, base: "HEAD" }
    : {};
  for (const directory of ["target", "node_modules"]) {
    test(`public ${directory} routes survive publication (changes: ${includeChanges})`, async (context) => {
      const fixture = await changedFixture(
        context,
        `${pageSource(`${directory}/handbook.html`)}\nmockups[1].route = ${JSON.stringify(`${directory}/home.html`)};`,
      );
      const output = path.join(fixture.root, ".context/published");
      await buildPreview(fixture.config, output, options);
      for (const document of [
        "handbook.html",
        "home.mobile.html",
        "home.desktop.html",
      ])
        assert.equal(
          fs.existsSync(
            path.join(output, "static/.generated", directory, document),
          ),
          true,
          document,
        );
      assert.match(
        await fs.promises.readFile(
          path.join(output, "view", directory, "handbook.html"),
          "utf8",
        ),
        /Handbook/,
      );
    });
  }

  for (const route of ["handbook.html", "screens/home.desktop.html"]) {
    test(`publication captures compiled ${route} even if enumeration omits it (changes: ${includeChanges})`, async (context) => {
      const fixture = await changedFixture(
        context,
        pageSource("handbook.html"),
      );
      const output = path.join(fixture.root, ".context/published");
      await buildPreview(fixture.config, output, options);
      const before = await fs.promises.readFile(
        path.join(output, "static/.generated", route),
      );
      const original = fs.promises.readdir;
      const omitted = path.join(fixture.config.generatedDir, route);
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
      await buildPreview(fixture.config, output, options);
      assert.deepEqual(
        await fs.promises.readFile(
          path.join(output, "static/.generated", route),
        ),
        before,
      );
      assert.equal(
        fs.existsSync(path.join(output, "static/.generated", route)),
        true,
      );
    });
  }
}
