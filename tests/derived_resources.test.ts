import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { acceptedGenerationFromCompilation } from "../dist/review/accepted_generation.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { derivedFixture } from "./helpers/derived_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const components of [false, true]) {
  test(`derived resource comparison (components=${components}) detects bytes absent from Git evidence`, async (t) => {
    const source = components
      ? componentEntrySource({
          actionRender:
            '(props) => <button>{props.label}<img src="../image.svg" /></button>',
        })
      : validEntrySource({ body: '<img src="../image.svg" />' });
    const fixture = await derivedFixture(
      t,
      source,
      Object.fromEntries(
        ["image.svg", "components/image.svg"].map((route) => [
          route,
          '<svg xmlns="http://www.w3.org/2000/svg"><title>Base</title></svg>',
        ]),
      ),
    );
    const prepared = await prepareReviewRepository(fixture.config, "HEAD");
    for (const route of ["image.svg", "components/image.svg"])
      await fs.writeFile(
        path.join(fixture.mockupsDir, route),
        '<svg xmlns="http://www.w3.org/2000/svg"><title>Changed</title></svg>',
      );
    const repository = {
      ...prepared,
      evidence: {
        ...prepared.evidence,
        changedPaths: async () => [],
      },
    };
    const changes = await readCatalogueChanges(
      fixture.config,
      fixture.baseline.manifest,
      "HEAD",
      repository,
      fixture.commit,
      acceptedGenerationFromCompilation(fixture.baseline),
    );
    if (components) {
      assert.equal(
        changes.result?.components.find((entry) => entry.id === "action")
          ?.state,
        "changed",
      );
      assert.ok(
        changes.result?.changes.some((entry) =>
          entry.reasons.some((reason) => reason.kind === "material"),
        ),
      );
      assert.deepEqual(changes.result?.changedPaths, []);
    } else
      assert.deepEqual(changes.changedRoutes, [
        "screens/home.html",
        "user-flows/tour.html",
      ]);
  });
}

test("derived whole-document pages compare source-only material changes", async (t) => {
  const source = `${validEntrySource()}
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ id: "guide", title: "Guide", description: "Guide", route: "guide.html", dependencies: [], relatedDocs: [], render: () => "<!doctype html><html><body><p>Original guide</p></body></html>" }));`;
  const fixture = await derivedFixture(t, source);
  await fs.writeFile(
    fixture.entryPath,
    source.replace("Original guide", "Updated guide"),
  );
  const changes = await computeCatalogueChanges(
    fixture.config,
    "HEAD",
    await prepareReviewRepository(fixture.config, "HEAD"),
  );
  assert.deepEqual(changes.changedRoutes, ["guide.html"]);
});
