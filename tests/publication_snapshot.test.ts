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
import { capturePublicationInputs } from "../scripts/preview/inputs.mjs";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("derived publication fingerprint ignores helper-owned output before and after freshness hydration", async (context) => {
  const fixture = await createFixture('export { mockups } from "./helper";');
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.entriesDir, "helper.tsx"),
    validEntrySource(),
  );
  await fs.promises.writeFile(
    fixture.configPath,
    (await fs.promises.readFile(fixture.configPath, "utf8")).replace(
      '"committed"',
      '"derived"',
    ),
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  await writeCompilation(compiled, await loadConfig(fixture.root));
  const config = await loadConfig(fixture.root);
  assert.equal(config.sourceFiles, undefined);
  const before = await capturePublicationInputs(config, []);
  await loadCatalogueSnapshot(config, undefined, compiled.manifest);
  assert.deepEqual(config.sourceFiles, compiled.manifest.sourceFiles);
  const after = await capturePublicationInputs(config, []);
  assert.equal(after.fingerprint, before.fingerprint);
});

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
  test(`publication includes a rebuild before its initial fingerprint in every surface (changes: ${includeChanges})`, async (context) => {
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
    const original = fs.promises.readdir;
    let rebuilt = false;
    context.mock.method(
      fs.promises,
      "readdir",
      async (...args: Parameters<typeof original>) => {
        if (String(args[0]) === config.repoRoot && !rebuilt) {
          rebuilt = true;
          await fs.promises.appendFile(
            fixture.entryPath,
            '\nimport { definePage } from "@mokly/mokly"; mockups.push(definePage({ id: "publication-added", title: "Added during publication", route: "publication-added.html", description: "A new document", dependencies: [], relatedDocs: [], render: () => "<!doctype html><html><body>Added document</body></html>" }));\n',
          );
          await writeCompilation(await compileCatalogue(config), config);
        }
        return original.apply(fs.promises, args);
      },
    );
    const output = path.join(fixture.root, ".context/published");
    await buildPreview(
      config,
      output,
      includeChanges ? { includeChanges, base: "HEAD" } : {},
    );
    assert.equal(rebuilt, true);
    const read = (file: string) =>
      fs.promises.readFile(path.join(output, file), "utf8");
    assert.match(await read("index.html"), /data-entry-id="publication-added"/);
    assert.match(
      await read("view/publication-added.html"),
      /Added during publication/,
    );
    assert.match(await read("static/publication-added.html"), /Added document/);
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

test("a manifest change after its snapshot read aborts default publication and preserves the previous artifact", async (context) => {
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
  const manifestPath = path.join(fixture.mockupsDir, "mokly-manifest.json");
  const original = fs.promises.readFile;
  let mutated = false;
  context.mock.method(
    fs.promises,
    "readFile",
    async (...args: Parameters<typeof original>) => {
      const result = await original.apply(fs.promises, args);
      if (String(args[0]) === manifestPath && !mutated) {
        mutated = true;
        fs.writeFileSync(
          manifestPath,
          result.toString().replace('"title": "Home"', '"title": "New title"'),
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
