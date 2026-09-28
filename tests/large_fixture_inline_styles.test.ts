import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";

test(
  "cumulative inline styles attribute one component without later non-consumers",
  { timeout: 120_000 },
  async (t) => {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/large-inline-styles-"),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    await generateLargeFixture(root, {
      areas: 2,
      inlineStyles: true,
      rows: 1,
      screens: 3,
      stylesheets: 0,
    });
    const config = await loadConfig(root);
    const baselineCompilation = await compileCatalogue(config);
    await writeCompilation(baselineCompilation, config);
    assert.deepEqual(
      (await compileCatalogue(config)).outputs,
      baselineCompilation.outputs,
    );
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: root, stdio: "pipe" });
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Mokly Test");
    git("config", "user.email", "mokly@example.invalid");
    git("add", ".");
    git("commit", "-qm", "test: inline style baseline");
    const renderer = path.join(root, "renderer.tsx");
    await fs.writeFile(
      renderer,
      (await fs.readFile(renderer, "utf8")).replace(
        'const AREA_ONE_ACTION_COLOR = "rgba(1,2,3,1.00)";',
        'const AREA_ONE_ACTION_COLOR = "rgba(4,5,6,1.00)";',
      ),
    );
    const compilation = await compileCatalogue(config);
    await writeCompilation(compilation, config);
    const manifest = compilation.manifest;
    const screenHtml = async (id: string) => {
      const entry = manifest.entries.find((candidate) => candidate.id === id);
      assert.ok(entry?.kind === "screen");
      return fs.readFile(
        path.join(root, "mockups", generatedViews(entry)[0]!.path),
        "utf8",
      );
    };
    const areaOneHtml = await Promise.all(
      [1, 2, 3].map((index) => screenHtml(`area-1-screen-${index}`)),
    );
    assert.ok(areaOneHtml[1]!.length > areaOneHtml[0]!.length);
    assert.ok(areaOneHtml[2]!.length > areaOneHtml[1]!.length);
    const laterHtml = await screenHtml("area-2-screen-1");
    assert.ok(laterHtml.length > areaOneHtml[2]!.length);
    assert.match(laterHtml, /rgba\(4,5,6,1\.00\)/);

    const snapshot = await computeCatalogueChanges(
      config,
      "main",
      committedReviewRepository(config),
    );
    const result = snapshot.componentChanges?.result;
    assert.equal(result?.schemaVersion, 3);
    if (result?.schemaVersion !== 3) return;
    assert.deepEqual(
      result.changes.map((change) => ({
        kind: change.kind,
        route: (change.after ?? change.before)!.route,
      })),
      [{ kind: "component", route: "area-1/components/action.html" }],
    );
    assert.deepEqual(
      [
        ...new Set(
          result.affectedConsumers.flatMap((affected) =>
            affected.changedComponentId === "area-1-action" &&
            affected.consumer.kind === "screen"
              ? [affected.consumer.route]
              : [],
          ),
        ),
      ].sort(),
      [
        "area-1/screens/activity-1.html",
        "area-1/screens/activity-2.html",
        "area-1/screens/activity-3.html",
      ],
    );
    assert.ok(
      !result.changes.some(
        (change) =>
          (change.after ?? change.before)?.route ===
          "area-2/screens/activity-1.html",
      ),
    );
    assert.ok(
      !result.affectedConsumers.some(
        (affected) =>
          affected.consumer.kind === "screen" &&
          affected.consumer.route === "area-2/screens/activity-1.html",
      ),
    );
  },
);
