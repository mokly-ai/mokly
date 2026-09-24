import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const kind of ["screen", "page"]) {
  for (const alias of ["file", "directory"]) {
    test(`${kind} compilation rejects a selected ${alias} alias`, async (context) => {
      const route = alias === "file" ? "image.svg" : "images/logo.svg";
      const source =
        kind === "screen"
          ? validEntrySource({
              body: `<img src="../../${route}" alt="Logo" />`,
            })
          : validEntrySource() +
            `\nimport { definePage } from "@mokly/mokly"; mockups.push(definePage({ id: "handbook", title: "Handbook", description: "Document", route: "handbook.html", dependencies: [], relatedDocs: [], render: () => '<html><body><img src="../${route}" alt="Logo"/></body></html>' }));`;
      const fixture = await changedFixture(
        context,
        source,
        undefined,
        async ({ mockupsDir }) => {
          await fs.mkdir(path.join(mockupsDir, "assets"));
          await fs.writeFile(
            path.join(mockupsDir, "assets/logo.svg"),
            '<svg width="10"/>',
          );
          if (alias === "file")
            await fs.copyFile(
              path.join(mockupsDir, "assets/logo.svg"),
              path.join(mockupsDir, "image.svg"),
            );
          else {
            await fs.mkdir(path.join(mockupsDir, "images"));
            await fs.copyFile(
              path.join(mockupsDir, "assets/logo.svg"),
              path.join(mockupsDir, "images/logo.svg"),
            );
          }
        },
      );
      const selected = path.join(
        fixture.mockupsDir,
        alias === "file" ? "image.svg" : "images",
      );
      await fs.rm(selected, { recursive: true });
      await fs.symlink(
        alias === "file" ? "assets/logo.svg" : "assets",
        selected,
      );
      await assert.rejects(
        compileCatalogue(fixture.config),
        /\[mokly\/build-invalid\].*document links and resources are invalid/s,
      );
    });
  }
}

test("unreferenced aliases remain private and outside Changes", async (context) => {
  const source = validEntrySource({
    body: "<p>Content</p>",
  });
  const fixture = await changedFixture(
    context,
    source,
    undefined,
    async ({ mockupsDir }) => {
      await fs.writeFile(path.join(mockupsDir, "actual.svg"), "<svg/>");
      await fs.symlink("actual.svg", path.join(mockupsDir, "image.svg"));
    },
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "actual.svg"),
    '<svg width="96"/>',
  );
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      await prepareReviewRepository(fixture.config, "HEAD"),
    ),
    [],
  );
  assert.deepEqual(
    (await compileCatalogue(fixture.config)).manifest.assetClosure,
    [],
  );
});
