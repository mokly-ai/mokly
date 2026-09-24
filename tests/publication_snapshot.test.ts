import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { loadCatalogueSnapshot } from "../dist/server/catalogue_snapshot.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("publication fingerprints inventoried helpers inside an otherwise ignored context directory", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.mkdir(path.join(fixture.root, ".context"));
  const helper = path.join(fixture.root, ".context/helper.ts");
  await fs.promises.writeFile(helper, 'export const title = "Context helper";');
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nimport { title } from "../.context/helper.ts"; mockups[0].title = title;',
  );
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const output = path.join(fixture.root, ".context/published");
  await buildPreview(await loadConfig(fixture.root), output);
  const previous = await fs.promises.readFile(
    path.join(output, "index.html"),
    "utf8",
  );
  assert.match(previous, /Context helper/);
  const original = globalThis.fetch;
  let mutated = false;
  context.mock.method(
    globalThis,
    "fetch",
    async (...args: Parameters<typeof original>) => {
      const response = await original(...args);
      if (!mutated && String(args[0]).includes("/view/")) {
        mutated = true;
        await fs.promises.appendFile(
          helper,
          '\nexport const extra = "mutation";',
        );
      }
      return response;
    },
  );
  await assert.rejects(
    buildPreview(await loadConfig(fixture.root), output),
    /inputs changed during publication/,
  );
  assert.equal(mutated, true);
  assert.equal(
    await fs.promises.readFile(path.join(output, "index.html"), "utf8"),
    previous,
  );
});

for (const includeChanges of [false, true]) {
  test(`publication compiles edits without writing local output (changes: ${includeChanges})`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
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
    const originalManifest = await fs.promises.readFile(
      path.join(fixture.mockupsDir, ".generated/mokly-manifest.json"),
    );
    await fs.promises.appendFile(
      fixture.entryPath,
      '\nimport { definePage } from "@mokly/mokly"; mockups.push(definePage({ id: "publication-added", title: "Added during publication", route: "publication-added.html", description: "A new document", dependencies: [], relatedDocs: [], render: () => "<!doctype html><html><body>Added document</body></html>" }));\n',
    );
    const output = path.join(fixture.root, ".context/published");
    await buildPreview(
      config,
      output,
      includeChanges ? { includeChanges, base: "HEAD" } : {},
    );
    assert.deepEqual(
      await fs.promises.readFile(
        path.join(fixture.mockupsDir, ".generated/mokly-manifest.json"),
      ),
      originalManifest,
    );
    assert.equal(
      fs.existsSync(
        path.join(fixture.mockupsDir, ".generated/publication-added.html"),
      ),
      false,
    );
    const read = (file: string) =>
      fs.promises.readFile(path.join(output, file), "utf8");
    assert.match(await read("index.html"), /data-entry-id="publication-added"/);
    assert.match(
      await read("view/publication-added.html"),
      /Added during publication/,
    );
    assert.match(
      await read("static/.generated/publication-added.html"),
      /Added document/,
    );
    assert.match(
      await read("_redirects"),
      /\/id\/publication-added \/view\/publication-added 302/,
    );
    if (includeChanges)
      assert.match(
        await read("index.html"),
        /<a[^>]*data-changed="true"[^>]*data-entry-id="publication-added"/,
      );
  });
}

test("an entry edit after snapshot capture aborts default publication and preserves the previous artifact", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const output = path.join(fixture.root, ".context/published");
  await buildPreview(config, output);
  const previous = await fs.promises.readFile(
    path.join(output, "index.html"),
    "utf8",
  );
  const original = globalThis.fetch;
  let mutated = false;
  context.mock.method(
    globalThis,
    "fetch",
    async (...args: Parameters<typeof original>) => {
      const result = await original(...args);
      if (!mutated && String(args[0]).includes("/view/")) {
        mutated = true;
        await fs.promises.appendFile(
          fixture.entryPath,
          '\nmockups[0].title = "New title";',
        );
      }
      return result;
    },
  );
  await assert.rejects(
    buildPreview(config, output),
    /inputs changed during publication/,
  );
  assert.equal(mutated, true);
  assert.equal(
    await fs.promises.readFile(path.join(output, "index.html"), "utf8"),
    previous,
  );
  assert.deepEqual(await fs.promises.readdir(path.dirname(output)), [
    ".mokly-export-reservations",
    "published",
  ]);
  assert.deepEqual(
    await fs.promises.readdir(
      path.join(path.dirname(output), ".mokly-export-reservations/locks"),
    ),
    [],
  );
});

test("the capture server rejects a snapshot from a different resolved config", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const snapshot = await loadCatalogueSnapshot(config);
  await assert.rejects(
    startCatalogueServer(await loadConfig(fixture.root), {
      base: "HEAD",
      port: 0,
      snapshot,
    }),
    /snapshot does not belong to this configuration/,
  );
});
