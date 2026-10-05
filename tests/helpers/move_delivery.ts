import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { readCatalogue, type CatalogueReadModel } from "@mokly/viewer";
import { parseReviewResult, viewHref } from "@mokly/viewer/data";
import { createCatalogue } from "@mokly/viewer/server";

import type { Compilation } from "../../dist/build/compile.js";
import { componentRuntime } from "../../dist/build/component_runtime.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { projectCatalogue } from "../../dist/catalogue/projection.js";
import { ConfiguredGitCommandRunner } from "../../dist/config/git.js";
import { loadConfig } from "../../dist/config/load.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import { exportCatalogue } from "../../dist/export/run.js";
import { compareReview } from "../../dist/review/compare.js";
import { CommittedRepository } from "../../dist/review/git.js";
import { computeCatalogueChanges } from "../../dist/server/changed.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import { readShellCatalogue } from "../../packages/viewer/src/catalogue/reader.js";

/** Record the real authoring files and accepted bytes before a fixture moves. */
export async function commitMoveBaseline(
  config: ResolvedConfig,
  before: Compilation,
): Promise<void> {
  await writeCompilation(before, config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: config.repoRoot, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", "-A");
  git("commit", "-qm", "test: move delivery baseline");
}

/** Carry each accepted move fixture across every public delivery boundary. */
export async function assertMoveDelivery(
  config: ResolvedConfig,
  after: Compilation,
): Promise<void> {
  config = await loadConfig(config.repoRoot, config.configPath);
  const git = new CommittedRepository(new ConfiguredGitCommandRunner(config));
  const review = await compareReview(after, config, git, "main");
  parseReviewResult(review.result);
  const changes = await computeCatalogueChanges(
    config,
    "main",
    git,
    after.manifest,
  );
  const model = projectCatalogue({
    catalogue: createCatalogue(after.manifest, changes.removedEntries),
    configPath: path.relative(config.repoRoot, config.configPath),
    changesStatus: "ready",
    comparisonUrl: null,
    changedEntries: changes.changedEntries,
    evidence: changes.componentChanges,
    revision: { content: 0, evidence: 0 },
  });
  assert.deepEqual(readCatalogue(model), model);
  assert.deepEqual(readShellCatalogue(model), model);
  assert.deepEqual(
    new Set(
      allEntries(model)
        .filter((entry) => entry.previousPath)
        .map((entry) =>
          JSON.stringify([entry.kind, entry.path, entry.previousPath]),
        ),
    ),
    new Set(
      (review.pairing?.moves ?? []).map((entry) =>
        JSON.stringify([entry.kind, entry.path, entry.previousPath]),
      ),
    ),
    "review and catalogue must carry the same accepted pairs",
  );
  const expected = identities(model);
  const server = await startCatalogueServer(config, {
    base: "main",
    port: 0,
    componentRuntime: componentRuntime(after),
    componentChanges: changes.componentChanges!,
    changedEntries: changes.changedEntries,
  });
  try {
    const served = readCatalogue(
      await (await fetch(`${server.url}/__mokly/catalogue.json`)).json(),
    );
    assert.deepEqual(identities(served), expected);
    for (const route of [
      "/",
      ...allEntries(model).map((entry) => viewHref(entry.path)),
    ])
      assert.equal((await fetch(`${server.url}${route}`)).status, 200, route);
  } finally {
    await server.close();
  }
  const outDir = path.join(config.repoRoot, ".context/move-delivery");
  await exportCatalogue(config, { outDir, base: "main" });
  const exported = readCatalogue(
    JSON.parse(
      await fs.readFile(path.join(outDir, "__mokly/catalogue.json"), "utf8"),
    ),
  );
  assert.deepEqual(identities(exported), expected);
  for (const entry of allEntries(exported))
    assert.ok(
      (
        await fs.stat(path.join(outDir, viewHref(entry.path), "index.html"))
      ).isFile(),
    );
}

function allEntries(model: CatalogueReadModel) {
  return [
    ...model.screens,
    ...model.pages,
    ...model.documents,
    ...model.useCases,
    ...model.components,
    ...model.removedEntries.map(({ entry }) => entry),
  ];
}
function identities(model: CatalogueReadModel) {
  return allEntries(model).map(({ kind, path, previousPath, changes }) => ({
    kind,
    path,
    previousPath,
    changes,
  }));
}
