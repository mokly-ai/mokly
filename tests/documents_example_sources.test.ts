import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { copyExampleSources } from "./helpers/example_sources.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("example fixtures copy authored Markdown and assets without generated resource copies", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/document-sources-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await copyExampleSources(root);
  assert.ok(
    (
      await fs.stat(path.join(root, "examples/basic/specs/example/README.md"))
    ).isFile(),
  );
  assert.ok(
    (
      await fs.stat(
        path.join(root, "examples/basic/specs/example/workspace.svg"),
      )
    ).isFile(),
  );
  assert.ok(
    (await fs.stat(path.join(root, "examples/basic/styles.css"))).isFile(),
  );
  for (const file of [
    "example/workspace.svg",
    "example/index.html",
    "mokly-manifest.json",
  ])
    await assert.rejects(
      fs.stat(path.join(root, "examples/basic/generated", file)),
      { code: "ENOENT" },
    );
});
