import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { committedReviewRepository } from "../dist/review/repository.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const kind of ["screen", "page"]) {
  for (const alias of ["file", "directory"]) {
    test(`${kind} Changes follows a stable ${alias} alias to its edited target`, async (context) => {
      const route = alias === "file" ? "image.svg" : "images/logo.svg";
      const source =
        kind === "screen"
          ? validEntrySource({ body: `<img src="../${route}" alt="Logo" />` })
          : validEntrySource() +
            `\nimport { definePage } from "@mokly/mokly"; mockups.push(definePage({ id: "handbook", title: "Handbook", description: "Document", route: "handbook.html", dependencies: [], relatedDocs: [], render: () => '<html><body><img src="${route}" alt="Logo"/></body></html>' }));`;
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
          await fs.symlink(
            alias === "file" ? "assets/logo.svg" : "assets",
            path.join(mockupsDir, alias === "file" ? "image.svg" : "images"),
          );
        },
      );
      await fs.writeFile(
        path.join(fixture.mockupsDir, "assets/logo.svg"),
        '<svg width="96"/>',
      );
      assert.deepEqual(
        await computeChangedRoutes(
          fixture.config,
          "HEAD",
          committedReviewRepository(fixture.config),
        ),
        kind === "screen"
          ? ["screens/home.html", "user-flows/tour.html"]
          : ["handbook.html"],
      );
    });
  }
}

test("ignored alias resources remain outside Changes after target edits", async (context) => {
  const source = validEntrySource({
    body: '<ReviewIgnore id="nav"><img src="../image.svg" alt="Logo" /></ReviewIgnore><p>Content</p>',
  }).replace("import { defineScreen", "import { ReviewIgnore, defineScreen");
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
      committedReviewRepository(fixture.config),
    ),
    [],
  );
});
