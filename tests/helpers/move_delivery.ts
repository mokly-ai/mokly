import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

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
import { PlainServeReporter } from "../../dist/server/reporter.js";
import { serve } from "../../dist/server/serve.js";
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

/** Keep one-sided views available through the real background and export paths. */
export async function assertSchemeMoveDelivery(
  t: TestContext,
  fixture: { config: ResolvedConfig; before: Compilation; after: Compilation },
  scenario: {
    kind: "screen" | "component";
    destination: string;
    moved: boolean;
    change: "added" | "removed" | "unchanged";
  },
): Promise<void> {
  const suffix = scenario.kind === "component" ? "/default" : "";
  const current = scenario.destination + suffix;
  const baseline = "old/home" + suffix;
  const check = (model: CatalogueReadModel) => {
    assert.equal(model.changesStatus, "ready");
    const entry = (
      scenario.kind === "screen" ? model.screens : model.components
    ).find((entry) => entry.path === current)!;
    assert.ok("views" in entry);
    if (entry.kind === "component")
      assert.deepEqual(entry.comparison, {
        status: "ready",
        kind:
          scenario.change === "removed"
            ? "changed"
            : scenario.change === "added"
              ? "added"
              : "unmodified",
        eligible: scenario.change === "removed",
      });
    assert.deepEqual(
      entry.views.map(({ viewport, colorScheme }) => [viewport, colorScheme]),
      ["mobile", "desktop"].flatMap((viewport) =>
        (scenario.change === "removed" ? ["light"] : ["light", "dark"]).map(
          (scheme) => [viewport, scheme],
        ),
      ),
    );
    for (const view of entry.views)
      assert.deepEqual(view.comparison, {
        status: "ready",
        kind:
          view.colorScheme === "dark" && scenario.change === "added"
            ? "added"
            : "unmodified",
        eligible: false,
      });
    assert.equal(entry.previousPath, scenario.moved ? baseline : undefined);
    assert.deepEqual(entry.changes, {
      status: "ready",
      included: true,
      kind: scenario.change === "unchanged" ? "unmodified" : "changed",
    });
  };
  await t.test("Serve", async () => {
    let finish!: (status: string) => void;
    const settled = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const messages: string[] = [];
    const reporter = new PlainServeReporter((line) => messages.push(line));
    reporter.changesReady = () => finish("ready");
    reporter.changesUnavailable = () => finish("unavailable");
    const running = await serve(
      fixture.config,
      { base: "main", port: 0, watch: false },
      { reporter },
    );
    try {
      assert.equal(await settled, "ready", messages.join(""));
      check(
        readCatalogue(
          await (await fetch(`${running.url}/__mokly/catalogue.json`)).json(),
        ),
      );
      assert.equal(
        (await fetch(`${running.url}/view/${current}/`)).status,
        200,
      );
      assert.equal(
        (await fetch(`${running.url}/static/${current}/index.mobile.html`))
          .status,
        200,
      );
    } finally {
      await running.close();
    }
  });
  await t.test("export", async () => {
    await exportCatalogue(fixture.config, { outDir: "site", base: "main" });
    const outDir = path.join(fixture.config.repoRoot, "site");
    const model = readCatalogue(
      JSON.parse(
        await fs.readFile(path.join(outDir, "__mokly/catalogue.json"), "utf8"),
      ),
    );
    check(model);
    assert.ok(model.comparisonUrl);
    const snapshots = path.join(
      outDir,
      path.dirname(model.comparisonUrl),
      "snapshots",
    );
    for (const side of ["before", "after"] as const)
      for (const viewport of ["mobile", "desktop"])
        for (const scheme of ["light", "dark"]) {
          const route = `${side === "before" ? baseline : current}/index.${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
          const expected = fixture[side].outputs.get(route);
          const file = path.join(snapshots, side, route);
          if (expected === undefined)
            await assert.rejects(fs.readFile(file), { code: "ENOENT" });
          else assert.equal(await fs.readFile(file, "utf8"), expected, route);
        }
  });
}
