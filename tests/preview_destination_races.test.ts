import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const includeChanges of [false, true]) {
  test(`publication preserves an unowned destination swapped during capture (changes: ${includeChanges})`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    if (includeChanges) {
      const git = new NodeGitCommandRunner(fixture.root);
      await git.run(["init", "-q"]);
      await git.run(["add", "."]);
      await git.run([
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "commit",
        "-qm",
        "test: publication baseline",
      ]);
    }
    const options = includeChanges
      ? { includeChanges: true as const, base: "HEAD" }
      : {};
    const output = path.join(fixture.root, ".context/published");
    const preserved = path.join(fixture.root, ".context/preserved");
    await buildPreview(config, output, options);
    const original = globalThis.fetch;
    let swapped = false;
    context.mock.method(
      globalThis,
      "fetch",
      async (...args: Parameters<typeof original>) => {
        const response = await original(...args);
        if (!swapped && String(args[0]).includes("/view/")) {
          swapped = true;
          await fs.promises.rename(output, preserved);
          await fs.promises.mkdir(output);
          await fs.promises.writeFile(
            path.join(output, "keep.txt"),
            "User-owned contents",
          );
        }
        return response;
      },
    );
    await assert.rejects(
      buildPreview(config, output, options),
      /destination|unowned/i,
    );
    assert.equal(swapped, true);
    assert.equal(
      await fs.promises.readFile(path.join(output, "keep.txt"), "utf8"),
      "User-owned contents",
    );
    assert.deepEqual(await fs.promises.readdir(output), ["keep.txt"]);
    assert.equal(
      fs.existsSync(path.join(preserved, ".mokly-export-artifact")),
      true,
    );
  });
}
