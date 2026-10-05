import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { readBaseManifest } from "../dist/review/base_manifest.js";
import { asChangeEvidence } from "../dist/review/change_evidence.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeChangedPaths } from "../dist/server/changed.js";
import { changedContentPaths } from "../dist/server/changed_content.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

const document =
  '<html><head><link rel="stylesheet" href="../document.css"></head><body><!--mokly-review-ignore:start:nav--><nav>Old navigation</nav><!--mokly-review-ignore:end:nav--><main>Document content</main></body></html>';
const source =
  validEntrySource() +
  `
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ path: "handbook", title: "Handbook", description: "A document", dependencies: ["notes.md"], relatedDocs: [], render: () => ${JSON.stringify(document)} }));
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
      await computeChangedPaths(
        fixture.config,
        "HEAD",
        committedReviewRepository(fixture.config),
      ),
      change === "material" || change === "resource" ? ["handbook"] : [],
    );
  });
}

test("v8 page resource evidence uses the merged changed-path set", async (context) => {
  const fixture = await changedFixture(
    context,
    source,
    undefined,
    async (item) => {
      await fs.writeFile(
        path.join(item.mockupsDir, "document.css"),
        "body { color: red; }",
      );
    },
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "document.css"),
    "body { color: blue; }",
  );
  const repository = committedReviewRepository(fixture.config);
  const commit = await repository.evidence.mergeBase("HEAD", "HEAD");
  const baseline = await readBaseManifest(
    repository.reader,
    commit,
    fixture.config,
  );
  const current = (await compileCatalogue(fixture.config)).manifest;
  assert.deepEqual(
    await changedContentPaths(
      current,
      baseline,
      fixture.config,
      repository.reader,
      commit,
      asChangeEvidence(["mockups/document.css"]),
    ),
    ["mockups/handbook/index.html"],
  );
});

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
  const fragment = path.join(fixture.mockupsDir, "home/index.mobile.html");
  await fs.writeFile(
    fragment,
    (await fs.readFile(fragment, "utf8")).replace(
      "</head>",
      '<script src="../helper.js"></script></head>',
    ),
  );
  assert.equal(
    await computeChangedPaths(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    undefined,
  );
});
