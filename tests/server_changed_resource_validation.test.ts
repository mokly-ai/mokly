import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readManifest } from "../dist/registry/manifest.js";
import { FileSystemReviewAssetReader } from "../dist/review/assets.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeChangedRoutes } from "../dist/server/changed.js";
import { classifyChangedContent } from "../dist/server/changed_content.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const reference of ["/root.css", "../notes.md", "missing.css"]) {
  test(`Changes rejects a changed stylesheet referencing ${reference}`, async (t) => {
    const fixture = await changedFixture(
      t,
      validEntrySource(),
      {
        extraConfig:
          'stylesheets: [{ match: "screens/home.html", stylesheets: ["home.css"] }],',
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
      await computeChangedRoutes(
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
      validEntrySource({ body: '<img src="../image.svg" alt="Logo" />' }),
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
      await computeChangedRoutes(
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
        'stylesheets: [{ match: "screens/home.html", stylesheets: ["home.css"] }],',
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
    await computeChangedRoutes(
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
      validEntrySource({ body: '<img src="../image.svg" alt="Before" />' }),
      undefined,
      async ({ mockupsDir }) => {
        await fs.writeFile(path.join(mockupsDir, "image.svg"), "<svg/>");
      },
    );
    const source = validEntrySource({
      body: '<img src="../image.svg" alt="After" />',
    });
    await fs.writeFile(
      fixture.entryPath,
      state === "added" ? source.replaceAll('"home"', '"new-home"') : source,
    );
    await fixture.build();
    await fs.unlink(path.join(fixture.mockupsDir, "image.svg"));
    await fs.symlink("../notes.md", path.join(fixture.mockupsDir, "image.svg"));
    assert.equal(
      await computeChangedRoutes(
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
    validEntrySource({ body: '<img src="../image.svg" alt="Logo" />' }),
    undefined,
    async ({ mockupsDir }) => {
      await fs.writeFile(path.join(mockupsDir, "image.svg"), "<svg/>");
    },
  );
  const entriesDir = path.join(fixture.mockupsDir, "src/entries");
  await fs.mkdir(entriesDir, { recursive: true });
  await fs.writeFile(path.join(entriesDir, "private.svg"), "<svg/>");
  await fs.unlink(path.join(fixture.mockupsDir, "image.svg"));
  await fs.symlink(
    "src/entries/private.svg",
    path.join(fixture.mockupsDir, "image.svg"),
  );
  assert.equal(
    await computeChangedRoutes(
      { ...fixture.config, entriesDir },
      "HEAD",
      committedReviewRepository({ ...fixture.config, entriesDir }),
    ),
    undefined,
  );
});

test("Changes rejects invalid references inside a changed embedded document", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource({
      body: '<iframe src="../embedded.html" title="Embed" />',
    }),
    undefined,
    async ({ mockupsDir }) => {
      await fs.writeFile(
        path.join(mockupsDir, "embedded.html"),
        "<p>Embed</p>",
      );
    },
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "embedded.html"),
    '<img src="/invalid.png" alt="Image">',
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

test("a removed resource beneath an escaping symlink is not a valid deletion", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource({ body: '<img src="../images/logo.svg" alt="Logo" />' }),
    undefined,
    async ({ mockupsDir }) => {
      await fs.mkdir(path.join(mockupsDir, "images"));
      await fs.writeFile(path.join(mockupsDir, "images/logo.svg"), "<svg/>");
    },
  );
  await fs.rm(path.join(fixture.mockupsDir, "images"), { recursive: true });
  await fs.symlink("../entries", path.join(fixture.mockupsDir, "images"));
  assert.equal(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    undefined,
  );
});

test("Changes retains a legitimate deleted resource directory", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource({ body: '<img src="../images/logo.svg" alt="Logo" />' }),
    undefined,
    async ({ mockupsDir }) => {
      await fs.mkdir(path.join(mockupsDir, "images"));
      await fs.writeFile(path.join(mockupsDir, "images/logo.svg"), "<svg/>");
    },
  );
  await fs.rm(path.join(fixture.mockupsDir, "images"), { recursive: true });
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    ["screens/home.html", "user-flows/tour.html"],
  );
});

test("README edits are not public content changes and require no resource traversal", async (t) => {
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
  class ObservedReader extends FileSystemReviewAssetReader {
    override async read(route: string) {
      reads.push(route);
      return super.read(route);
    }
  }
  const manifest = readManifest(fixture.config);
  const result = await classifyChangedContent(
    manifest,
    manifest,
    fixture.config,
    committedReviewRepository(fixture.config).reader,
    "HEAD",
    ["mockups/README.md"],
    new ObservedReader(fixture.config),
  );
  assert.deepEqual(result, { changedPaths: [], screens: [] });
  assert.deepEqual(reads, []);
});
