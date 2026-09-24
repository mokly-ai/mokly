import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { committedReviewRepository } from "../dist/review/repository.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const resource of ["home.css", "nested.css", "image.svg"]) {
  test(`Changes finds a referenced ${resource} edit with identical fragments`, async (t) => {
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
          '@import "nested.css";',
        );
        await fs.writeFile(
          path.join(mockupsDir, "nested.css"),
          '@import "home.css"; body { background: url("image.svg"); }',
        );
        await fs.writeFile(
          path.join(mockupsDir, "image.svg"),
          '<svg xmlns="http://www.w3.org/2000/svg"/>',
        );
      },
    );
    await fs.appendFile(
      path.join(fixture.mockupsDir, resource),
      resource.endsWith(".css") ? "\nmain { color: red; }" : "\n",
    );
    assert.deepEqual(
      await computeChangedRoutes(
        fixture.config,
        "HEAD",
        committedReviewRepository(fixture.config),
      ),
      ["screens/home.html", "user-flows/tour.html"],
    );
  });
}

test("a newline-only stylesheet edit leaves every consumer out of Changes", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource(),
    {
      extraConfig:
        'stylesheets: [{ match: "**/*.html", stylesheets: ["home.css"] }],',
    },
    async ({ mockupsDir }) => {
      await fs.writeFile(
        path.join(mockupsDir, "home.css"),
        "main { color: red; }",
      );
    },
  );
  await fs.appendFile(path.join(fixture.mockupsDir, "home.css"), "\n");
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    [],
  );
});

test("unused public files do not fill Changes", async (t) => {
  const fixture = await changedFixture(t);
  await fs.writeFile(
    path.join(fixture.mockupsDir, "unused.css"),
    "body { color: red; }",
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

test("Changes includes a removed resource referenced by an unchanged screen", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource({ body: '<img src="../image.svg" alt="Logo" />' }),
    undefined,
    async ({ mockupsDir }) => {
      await fs.writeFile(
        path.join(mockupsDir, "image.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
      );
    },
  );
  await fs.unlink(path.join(fixture.mockupsDir, "image.svg"));
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    ["screens/home.html", "user-flows/tour.html"],
  );
});

test("assets used only inside paired ignored regions stay out of Changes", async (t) => {
  const source = validEntrySource({
    body: '<ReviewIgnore id="nav"><img src="../image.svg" alt="Logo" /></ReviewIgnore><p>Content</p>',
  }).replace(
    "import { defineCollection",
    "import { ReviewIgnore, defineCollection",
  );
  const fixture = await changedFixture(
    t,
    source,
    undefined,
    async ({ mockupsDir }) => {
      await fs.writeFile(
        path.join(mockupsDir, "image.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
      );
    },
  );
  await fs.appendFile(path.join(fixture.mockupsDir, "image.svg"), "\n");
  assert.deepEqual(
    await computeChangedRoutes(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    [],
  );
});
