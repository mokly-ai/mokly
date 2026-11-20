import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";

import { consumer } from "./helpers/mokly_serve.js";
import { command } from "./helpers/static_publication.js";

test("Storybook Button template and excluded stories build with strict mode", async (context) => {
  const fixture = new URL("./fixtures/sidecar/", import.meta.url);
  const root = await consumer(context, {
    "specs/Button.tsx": await fs.readFile(
      new URL("storybook-template/Button.tsx", fixture),
      "utf8",
    ),
    "specs/Button.stories.tsx": await fs.readFile(
      new URL("storybook-template/Button.stories.tsx", fixture),
      "utf8",
    ),
    "specs/no-included.stories.tsx": await fs.readFile(
      new URL("no-included.stories.tsx", fixture),
      "utf8",
    ),
    "specs/no-exports.stories.tsx": await fs.readFile(
      new URL("no-exports.stories.tsx", fixture),
      "utf8",
    ),
  });
  const built = await command(
    root,
    "build",
    ["--no-changes", "--strict"],
    "plain",
    {},
    context.signal,
  ).result;
  assert.equal(built.code, 0, built.stderr);
  assert.equal(built.stderr, "");
  const index = readCatalogueIndex(
    JSON.parse(
      await fs.readFile(
        path.join(root, "mokly-static/mokly-viewer/index.json"),
        "utf8",
      ),
    ),
  );
  assert.deepEqual(
    index.components
      .map(({ path, title }) => ({ path, title }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    [
      { path: "Button", title: "Button" },
      { path: "Button/Large", title: "Large" },
      { path: "Button/Primary", title: "Primary" },
      { path: "Button/Secondary", title: "Secondary" },
      { path: "Button/Small", title: "Small" },
    ],
  );
});
