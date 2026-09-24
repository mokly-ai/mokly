import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { committedReviewRepository } from "../dist/review/repository.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

const document =
  '<html><head><link rel="stylesheet" href="document.css"></head><body><!--mokly-review-ignore:start:nav--><nav>Old navigation</nav><!--mokly-review-ignore:end:nav--><main>Document content</main></body></html>';
const source =
  validEntrySource() +
  `
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ id: "handbook", title: "Handbook", description: "A document", route: "handbook.html", relatedDocs: [], render: () => ${JSON.stringify(document)} }));
`;

for (const change of [
  "material",
  "ignored",
  "resource",
  "dependency",
] as const) {
  test(`page Changes applies material output rules to ${change} edits`, async (context) => {
    const fixture = await changedFixture(
      context,
      source,
      undefined,
      async (fixture) => {
        await fs.writeFile(
          path.join(fixture.mockupsDir, "document.css"),
          "body { color: red; }",
        );
      },
    );
    if (change === "resource") {
      await fs.writeFile(
        path.join(fixture.mockupsDir, "document.css"),
        "body { color: blue; }",
      );
    } else if (change === "dependency") {
      await fs.writeFile(
        path.join(fixture.root, "notes.md"),
        "Updated dependency evidence",
      );
    } else {
      await fs.writeFile(
        fixture.entryPath,
        change === "material"
          ? source.replace("Document content", "Updated document content")
          : source.replace("Old navigation", "New navigation"),
      );
      await fixture.build();
    }
    assert.deepEqual(
      await computeChangedRoutes(
        fixture.config,
        "HEAD",
        committedReviewRepository(fixture.config),
      ),
      change === "material" || change === "resource" ? ["handbook.html"] : [],
    );
  });
}

test("Changes cannot treat a historical authoring input as a deleted public resource", async (context) => {
  const fixture = await changedFixture(
    context,
    validEntrySource() +
      '\nimport { label } from "../mockups/helper.js"; mockups[0].title = label;',
    undefined,
    async (fixture) => {
      await fs.writeFile(
        path.join(fixture.mockupsDir, "helper.js"),
        'export const label = "Fixture";',
      );
    },
  );
  await fs.writeFile(fixture.entryPath, validEntrySource());
  await fixture.build();
  await fs.rm(path.join(fixture.mockupsDir, "helper.js"));
  const fragment = path.join(fixture.mockupsDir, "screens/home.mobile.html");
  await fs.writeFile(
    fragment,
    (await fs.readFile(fragment, "utf8")).replace(
      "</head>",
      '<script src="../helper.js"></script></head>',
    ),
  );
  assert.equal(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    undefined,
  );
});
