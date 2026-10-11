import assert from "node:assert/strict";
import test from "node:test";

import { snapshotViewPath, snapshotResourcePath } from "@mokly/viewer/data";

import { generatedBytes } from "../dist/build/generated_file.js";
import { acceptedGenerationFromCompilation } from "../dist/review/accepted_generation.js";
import { compareReview } from "../dist/review/compare.js";
import { RepositoryRemovedPagePreview } from "../dist/review/page_preview.js";
import { RepositorySelectedReview } from "../dist/review/selected.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";

import { committedReviewRepository } from "./helpers/committed_repository.js";
import {
  inventoryComparisonFixture,
  imageBytes,
} from "./helpers/inventory_comparison_fixture.js";

for (const kind of [
  "page",
  "screen",
  "Markdown",
  "CSS",
  "generated asset",
  "copied asset",
  "authored HTML",
] as const)
  for (const edit of ["added", "removed", "renamed"] as const) {
    test(`${edit} ${kind} uses each side's inventory through live and captured comparisons`, async (t) => {
      const fixture = await inventoryComparisonFixture(t, kind, edit);
      const repository = committedReviewRepository(fixture.config);
      const live = await computeCatalogueChanges(
        fixture.config,
        "HEAD",
        repository,
        fixture.after.manifest,
        undefined,
        acceptedGenerationFromCompilation(fixture.after),
      );
      assert.ok(live.componentChanges?.result);
      if (edit !== "renamed") assert.ok(live.changedEntries.includes("home"));
      const full = await compareReview(
        fixture.after,
        fixture.config,
        repository,
        "HEAD",
      );
      const comparison = live.componentChanges.comparison!;
      const selected = await new RepositorySelectedReview(
        fixture.config,
        repository.reader,
      ).generate(
        {
          ...comparison,
          before: fixture.before.manifest,
          after: fixture.after.manifest,
          result: live.componentChanges.result,
        },
        { path: "home" },
        new AbortController().signal,
      );
      for (const side of ["before", "after"] as const) {
        const compilation = side === "before" ? fixture.before : fixture.after;
        const files = [...compilation.outputs].filter(
          ([route]) => !route.endsWith(".json"),
        );
        for (const artifact of [full, selected]) {
          const home = artifact.files.get(
            snapshotViewPath(side, "home", "mobile", "light"),
          );
          assert.ok(home, `${side} home snapshot`);
          assert.deepEqual(
            generatedBytes(home),
            generatedBytes(compilation.outputs.get("home/index.mobile.html")!),
          );
          for (const [route, bytes] of files.filter(([route]) =>
            /(?:picture|next)\.png$/.test(route),
          )) {
            const captured = artifact.files.get(
              snapshotResourcePath(side, `mokly-generated/${route}`),
            );
            assert.ok(captured, `${kind} ${edit} ${side} ${route}`);
            assert.deepEqual(generatedBytes(captured), imageBytes);
            assert.deepEqual(generatedBytes(bytes), imageBytes);
          }
        }
      }
      if (edit === "removed" && (kind === "page" || kind === "Markdown")) {
        const preview = await new RepositoryRemovedPagePreview(
          fixture.config,
          repository.reader,
        ).generate(
          { ...live, baseline: fixture.before.manifest },
          { kind: "page", path: "embed" },
          new AbortController().signal,
        );
        assert.ok(
          [...preview.files.keys()].some((file) =>
            file.includes("embed/index.html"),
          ),
        );
        if (kind === "Markdown")
          assert.ok(
            [...preview.files.keys()].some((file) =>
              file.endsWith("guide.pdf"),
            ),
          );
      }
    });
  }
