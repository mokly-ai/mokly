import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { readManifest } from "../dist/registry/manifest.js";
import { asChangeEvidence } from "../dist/review/change_evidence.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";
import { computeChangedPaths } from "../dist/server/changed.js";
import { classifyChangedContent } from "../dist/server/changed_content.js";

import { changedFixture, retainedChanges } from "./helpers/changed_fixture.js";
import { committedReviewRepository } from "./helpers/committed_repository.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const reference of ["/root.css", "../notes.md", "missing.css"]) {
  test(`Changes rejects a changed stylesheet referencing ${reference}`, async (t) => {
    const fixture = await changedFixture(
      t,
      validEntrySource(),
      {
        extraConfig:
          'stylesheets: [{ match: "home/index.html", stylesheets: ["home.css"] }],',
      },
      async ({ mockupsDir }) => {
        await fs.writeFile(path.join(mockupsDir, "home.css"), "body {}");
      },
    );
    await fs.writeFile(
      path.join(fixture.mockupsDir, "home.css"),
      `@import "${reference}";`,
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
}

for (const replacement of ["outside", "source", "dangling", "directory"]) {
  test(`Changes rejects a changed image replaced by a ${replacement} target`, async (t) => {
    const fixture = await changedFixture(
      t,
      validEntrySource({ body: '<img src="../../image.svg" alt="Logo" />' }),
      undefined,
      async ({ mockupsDir }) => {
        await fs.writeFile(path.join(mockupsDir, "image.svg"), "<svg/>");
      },
    );
    const image = path.join(fixture.mockupsDir, "image.svg");
    await fs.unlink(image);
    if (replacement === "directory") await fs.mkdir(image);
    else
      await fs.symlink(
        replacement === "outside"
          ? "../notes.md"
          : replacement === "source"
            ? fixture.entryPath
            : "missing.svg",
        image,
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
}

test("Changes validates other resources after finding a changed resource", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource(),
    {
      extraConfig:
        'stylesheets: [{ match: "home/index.html", stylesheets: ["home.css"] }],',
    },
    async ({ mockupsDir }) => {
      await fs.writeFile(
        path.join(mockupsDir, "home.css"),
        '@import "a.css"; @import "z.css";',
      );
      await fs.writeFile(path.join(mockupsDir, "a.css"), "body {}");
      await fs.writeFile(path.join(mockupsDir, "z.css"), "p {}");
    },
  );
  await fs.appendFile(path.join(fixture.mockupsDir, "a.css"), "\n");
  await fs.writeFile(
    path.join(fixture.mockupsDir, "z.css"),
    'p { background: url("/invalid.png"); }',
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

for (const state of ["changed", "added"]) {
  test(`Changes validates resources even when the screen is already ${state}`, async (t) => {
    const fixture = await changedFixture(
      t,
      validEntrySource({ body: '<img src="../../image.svg" alt="Before" />' }),
      undefined,
      async ({ mockupsDir }) => {
        await fs.writeFile(path.join(mockupsDir, "image.svg"), "<svg/>");
      },
    );
    const source = validEntrySource({
      body: '<img src="../../image.svg" alt="After" />',
    });
    await fs.writeFile(
      fixture.entryPath,
      state === "added" ? source.replaceAll('"home"', '"new-home"') : source,
    );
    await fixture.build();
    await fs.unlink(path.join(fixture.mockupsDir, "image.svg"));
    await fs.symlink("../notes.md", path.join(fixture.mockupsDir, "image.svg"));
    assert.equal(
      await computeChangedPaths(
        fixture.config,
        "HEAD",
        committedReviewRepository(fixture.config),
      ),
      undefined,
    );
  });
}

test("Changes rejects resources symlinked into source roots inside mockupsDir", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource({ body: '<img src="../../image.svg" alt="Logo" />' }),
    undefined,
    async ({ mockupsDir, configPath }) => {
      await fs.writeFile(path.join(mockupsDir, "image.svg"), "<svg/>");
      await fs.mkdir(path.join(mockupsDir, "private"));
      await fs.writeFile(path.join(mockupsDir, "private/source.md"), "<svg/>");
      await fs.writeFile(
        configPath,
        'export default {mockupsDir:"mockups",roots:[{dir:"entries"},{dir:"mockups/private",files:["*.md"]}],review:{outDir:".review"}};',
      );
    },
  );
  await fs.unlink(path.join(fixture.mockupsDir, "image.svg"));
  await fs.symlink(
    "private/source.md",
    path.join(fixture.mockupsDir, "image.svg"),
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

test("Changes rejects invalid references inside a changed embedded document", async (t) => {
  const source =
    validEntrySource({
      body: '<iframe src="../embedded/index.html" title="Embed" />',
    }) +
    '\nimport { definePage } from "@mokly/mokly"; mockups.push(definePage({ path: "embedded", title: "Embed", description: "Embedded page", relatedDocs: [], render: () => "<html><body>Valid embedded page</body></html>" }));';
  const fixture = await changedFixture(t, source);
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      "Valid embedded page",
      "<img src='/invalid.png' alt='Image'>",
    ),
  );
  await assert.rejects(compileCatalogue(fixture.config), /root-absolute link/);
  assert.equal(
    await computeChangedPaths(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    undefined,
  );
});

test("a removed resource beneath an escaping symlink is not a valid deletion", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource({
      body: '<img src="../../images/logo.svg" alt="Logo" />',
    }),
    undefined,
    async ({ mockupsDir }) => {
      await fs.mkdir(path.join(mockupsDir, "images"));
      await fs.writeFile(path.join(mockupsDir, "images/logo.svg"), "<svg/>");
    },
  );
  await fs.rm(path.join(fixture.mockupsDir, "images"), { recursive: true });
  await fs.symlink("../entries", path.join(fixture.mockupsDir, "images"));
  assert.equal(
    await computeChangedPaths(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    undefined,
  );
});

test("Changes rejects deleted directories still referenced by a screen", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource({
      body: '<img src="../../images/logo.svg" alt="Logo" />',
    }),
    undefined,
    async ({ mockupsDir }) => {
      await fs.mkdir(path.join(mockupsDir, "images"));
      await fs.writeFile(path.join(mockupsDir, "images/logo.svg"), "<svg/>");
    },
  );
  await fs.rm(path.join(fixture.mockupsDir, "images"), { recursive: true });
  assert.deepEqual(
    await computeChangedPaths(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    undefined,
  );
  assert.deepEqual((await retainedChanges(fixture)).changedEntries, [
    "home",
    "tour",
  ]);
});

test("README edits do not change public content after all four generated views are read", async (t) => {
  const fixture = await changedFixture(
    t,
    undefined,
    undefined,
    async ({ mockupsDir }) => {
      await fs.writeFile(path.join(mockupsDir, "README.md"), "Before");
    },
  );
  await fs.writeFile(path.join(fixture.mockupsDir, "README.md"), "After");
  const reads: string[] = [];
  class ObservedReader extends CompiledReviewAssetReader {
    override async read(route: string) {
      reads.push(route);
      return super.read(route);
    }
  }
  const manifest = readManifest(fixture.config);
  const accepted = await compileCatalogue(fixture.config);
  const result = await classifyChangedContent(
    manifest,
    manifest,
    fixture.config,
    committedReviewRepository(fixture.config).reader,
    "HEAD",
    asChangeEvidence(["mockups/README.md"]),
    new ObservedReader(fixture.config, accepted.outputs),
  );
  assert.deepEqual(result, { changedPaths: [], screens: [], pages: [] });
  assert.deepEqual(reads.sort(), [
    "mokly-generated/details/index.desktop.html",
    "mokly-generated/details/index.mobile.html",
    "mokly-generated/home/index.desktop.html",
    "mokly-generated/home/index.mobile.html",
  ]);
});
