import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { childEnvironment } from "../scripts/verification/child-environment.mjs";

test("children cannot inherit the caller's Git index or org token", () => {
  const input = {
    BLACKSMITH_ORG_TOKEN: "fixture-only",
    GIT_DIR: "/other",
    GIT_INDEX_FILE: "/other/index",
    GIT_CONFIG_PARAMETERS: "fixture",
    PATH: "/tools",
    MOKLY_VERIFICATION_OWNER_ID: "owner",
  };
  assert.deepEqual(childEnvironment(input), {
    PATH: "/tools",
    MOKLY_VERIFICATION_OWNER_ID: "owner",
  });
  assert.equal(input.GIT_INDEX_FILE, "/other/index");
});

test("Node and Rust remove exactly the same Git repository variables", async () => {
  const names = (source: string) =>
    [...source.matchAll(/"(GIT_[A-Z_]+)"/g)].map((match) => match[1]!).sort();
  const rust = names(
    await fs.readFile(
      new URL("../xtask/src/child_environment.rs", import.meta.url),
      "utf8",
    ),
  );
  const node = names(
    await fs.readFile(
      new URL("../scripts/verification/child-environment.mjs", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(rust.length, 15);
  assert.deepEqual(node, rust);
  assert.deepEqual(
    childEnvironment(Object.fromEntries(rust.map((name) => [name, "fixture"]))),
    {},
  );
});
