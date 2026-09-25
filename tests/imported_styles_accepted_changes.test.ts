import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { acceptedGenerationFromCompilation } from "../dist/review/accepted_generation.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { loadCatalogueSnapshot } from "../dist/server/catalogue_snapshot.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";

import { removeFixture } from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";

async function baseline(
  context: { after(callback: () => Promise<void>): void },
  plugin = false,
) {
  const fixture = await styleFixture(".card{color:red}", {
    extraConfig: plugin ? 'postcss: "postcss.config.mjs",' : "",
  });
  context.after(() => removeFixture(fixture));
  const counter = path.join(fixture.root, "counter.log");
  if (plugin)
    await fs.writeFile(
      path.join(fixture.root, "postcss.config.mjs"),
      `import fs from "node:fs"; export default { plugins: [{ postcssPlugin: "count", Once() { fs.appendFileSync(${JSON.stringify(counter)}, "x\\n"); } }] };`,
    );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", ".");
  git("commit", "-qm", "baseline");
  const commit = git("rev-parse", "HEAD").toString().trim();
  return { fixture, config, compilation, commit, counter };
}

test("accepted committed classification does not rerun PostCSS", async (context) => {
  const { fixture, config, counter, commit } = await baseline(context, true);
  await fs.appendFile(
    path.join(fixture.entriesDir, "fixture.css"),
    "\n.card{padding:1px}",
  );
  const accepted = await compileCatalogue(config);
  await writeCompilation(accepted, config);
  await fs.writeFile(counter, "");
  const repository = committedReviewRepository(config);
  await readCatalogueChanges(
    { ...config, sourceFiles: accepted.manifest.sourceFiles },
    accepted.manifest,
    "HEAD",
    repository,
    commit,
    acceptedGenerationFromCompilation(accepted),
  );
  assert.equal(await fs.readFile(counter, "utf8"), "");
});

test("accepted generation stays classifiable after a newer CSS-importing entry appears", async (context) => {
  const { fixture, config, compilation, commit } = await baseline(context);
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.css"),
    ".new{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.mockup.tsx"),
    'import "./second.css"; export const mockups = [];',
  );
  const snapshot = await readCatalogueChanges(
    { ...config, sourceFiles: compilation.manifest.sourceFiles },
    compilation.manifest,
    "HEAD",
    committedReviewRepository(config),
    commit,
    acceptedGenerationFromCompilation(compilation),
  );
  assert.deepEqual(snapshot.changedRoutes, []);
});

test("catalogue freshness shares one inventory graph with committed Changes", async (context) => {
  const { fixture, config, counter } = await baseline(context, true);
  await fs.appendFile(
    path.join(fixture.entriesDir, "fixture.css"),
    "\n.card{padding:1px}",
  );
  const accepted = await compileCatalogue(config);
  await writeCompilation(accepted, config);
  await fs.writeFile(counter, "");
  const repository = committedReviewRepository(config);
  await loadCatalogueSnapshot(
    { ...config, sourceFiles: accepted.manifest.sourceFiles },
    (manifest, generation) =>
      computeCatalogueChanges(
        config,
        "HEAD",
        repository,
        manifest,
        undefined,
        generation,
      ),
    accepted.manifest,
  );
  assert.equal(
    (await fs.readFile(counter, "utf8")).trim().split("\n").length,
    1,
  );
});
