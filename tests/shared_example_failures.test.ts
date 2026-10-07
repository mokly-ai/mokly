import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";

import { SHARED_EXAMPLE_DESCRIPTOR_ENV } from "./helpers/example_descriptor.js";
import {
  acquireSharedExample,
  prepareSharedExample,
  sharedExampleEnvironment,
} from "./helpers/shared_example.js";
import { createMiniExample } from "./helpers/shared_example_test_source.js";

for (const mutation of [
  "version",
  "commit",
  "recipe",
  "root",
  "missing",
  "marker",
  "lock",
  "extraction",
  "symlink",
  "source",
] as const)
  test(`shared baseline ${mutation} corruption fails instead of rebuilding`, async () => {
    let preparations = 0;
    const shared = await prepareSharedExample({
      createSource: async (root) => {
        preparations++;
        return createMiniExample(root);
      },
    });
    const environment = sharedExampleEnvironment(shared);
    try {
      const descriptor = { ...shared.descriptor };
      if (mutation === "version")
        Object.assign(descriptor, { schemaVersion: 2 });
      if (mutation === "commit") descriptor.commit = "a".repeat(40);
      if (mutation === "recipe")
        descriptor.commands = [["node", "different.mjs"]];
      if (mutation === "root")
        descriptor.repository = path.dirname(shared.root);
      if (mutation === "missing") await fs.rm(shared.descriptorPath);
      else if (mutation === "marker")
        await fs.rm(cacheLayout(shared.root, shared.commit).marker);
      else if (mutation === "lock")
        await fs.writeFile(
          cacheLayout(shared.root, shared.commit).lock,
          "active",
        );
      else if (mutation === "extraction")
        await fs.mkdir(cacheLayout(shared.root, shared.commit).source);
      else if (mutation === "symlink")
        await fs.symlink(
          shared.root,
          path.join(cacheLayout(shared.root, shared.commit).output, "linked"),
          "dir",
        );
      else if (mutation === "source")
        await fs.appendFile(
          path.join(shared.root, "examples/basic/entries/home.mockup.ts"),
          "\n// mutation\n",
        );
      else
        await fs.writeFile(shared.descriptorPath, JSON.stringify(descriptor));
      await assert.rejects(acquireSharedExample("invalid", { environment }));
      assert.equal(preparations, 1);
    } finally {
      if (
        ["marker", "lock", "extraction", "symlink", "source"].includes(mutation)
      )
        await assert.rejects(shared.close(), /Shared example teardown failed/u);
      else await shared.close();
    }
    await assert.rejects(fs.access(shared.root), { code: "ENOENT" });
  });

test("one invocation cannot consume another invocation's descriptor", async () => {
  const first = await prepareSharedExample({ createSource: createMiniExample });
  const second = await prepareSharedExample({
    createSource: createMiniExample,
  });
  try {
    await assert.rejects(
      acquireSharedExample("foreign", {
        environment: {
          ...sharedExampleEnvironment(first),
          [SHARED_EXAMPLE_DESCRIPTOR_ENV]: second.descriptorPath,
        },
      }),
      /not prepared by this invocation/u,
    );
  } finally {
    await first.close();
    await second.close();
  }
});
