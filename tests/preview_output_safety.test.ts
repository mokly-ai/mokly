import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../packages/mokly/dist/config/load.js";
import type { PublicationOptions } from "../packages/mokly/dist/publication/options.js";
import { NodeGitCommandRunner } from "../packages/mokly/dist/review/git.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const includeChanges of [false, true]) {
  for (const link of ["context", "parent", "output"] as const) {
    test(`publication rejects an escaping ${link} symlink before writes (changes: ${includeChanges})`, async (context) => {
      const fixture = await createFixture();
      const outside = await createFixture();
      context.after(() => removeFixture(fixture));
      context.after(() => removeFixture(outside));
      const config = await loadConfig(fixture.root);
      await writeCompilation(await compileCatalogue(config), config);
      const contextRoot = path.join(fixture.root, ".context");
      const linked =
        link === "context" ? contextRoot : path.join(contextRoot, "linked");
      await fs.promises.mkdir(path.dirname(linked), { recursive: true });
      await fs.promises.symlink(outside.root, linked);
      const output =
        link === "output" ? linked : path.join(linked, "new/output");
      await fs.promises.writeFile(
        path.join(outside.root, ".mokly-preview-artifact"),
        "schemaVersion=1\n",
      );
      const before = await fs.promises.readdir(outside.root, {
        recursive: true,
      });
      await assert.rejects(
        buildPreview(config, output, { includeChanges }),
        /preview output must be inside/,
      );
      assert.deepEqual(
        await fs.promises.readdir(outside.root, { recursive: true }),
        before,
      );
      assert.equal(
        await fs.promises.readFile(path.join(outside.root, "notes.md"), "utf8"),
        "# Fixture notes\n",
      );
    });
  }
}

for (const includeChanges of [false, true]) {
  test(`publication accepts context and parent symlinks contained by the real repository (changes: ${includeChanges})`, async (context) => {
    const fixture = await createFixture();
    const aliasRoot = await createFixture();
    context.after(() => removeFixture(fixture));
    context.after(() => removeFixture(aliasRoot));
    const rootAlias = path.join(aliasRoot.root, "repository");
    await fs.promises.symlink(fixture.root, rootAlias);
    const config = await loadConfig(rootAlias);
    await writeCompilation(await compileCatalogue(config), config);
    if (includeChanges) {
      const runner = new NodeGitCommandRunner(fixture.root);
      await runner.run(["init", "-q"]);
      await runner.run(["add", "."]);
      await runner.run([
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "commit",
        "-qm",
        "test: publication baseline",
      ]);
    }
    const artifacts = path.join(fixture.root, "artifacts");
    await fs.promises.mkdir(path.join(artifacts, "nested"), {
      recursive: true,
    });
    await fs.promises.symlink("artifacts", path.join(fixture.root, ".context"));
    await fs.promises.symlink("nested", path.join(artifacts, "linked"));
    const output = path.join(rootAlias, ".context/linked/published");
    const options: PublicationOptions = includeChanges
      ? { includeChanges: true, base: "HEAD" }
      : {};
    await buildPreview(config, output, options);
    assert.match(
      await fs.promises.readFile(
        path.join(artifacts, "nested/published/index.html"),
        "utf8",
      ),
      /<title>Mokly<\/title>/,
    );
    await buildPreview(config, output, options);
    assert.equal(fs.existsSync(path.join(output, "index.html")), true);
  });
}
