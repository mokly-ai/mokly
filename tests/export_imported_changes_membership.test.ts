import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { exportCatalogue } from "../dist/export/run.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { importedChangesFixture } from "./helpers/imported_changes_fixture.js";

interface PublishedEntry {
  readonly route: string;
  readonly changes: { readonly kind: string; readonly included: boolean };
}

async function readMembership(
  root: string,
): Promise<Map<string, PublishedEntry["changes"]>> {
  const catalogue = JSON.parse(
    await fs.readFile(path.join(root, "__mokly/catalogue.json"), "utf8"),
  ) as {
    screens: PublishedEntry[];
  };
  return new Map(
    catalogue.screens.map((entry) => [entry.route, entry.changes]),
  );
}

for (const mode of ["committed", "derived"] as const)
  for (const kind of ["plain", "module", "asset"] as const) {
    test(
      `${mode} ${kind} exported and published Changes match live rule attribution`,
      { timeout: 120_000 },
      async (context) => {
        const fixture = await importedChangesFixture(context, mode, kind);
        if (kind === "asset")
          await fs.writeFile(
            path.join(fixture.entriesDir, "font.woff2"),
            Buffer.from([0, 2, 3]),
          );
        else
          await fs.appendFile(fixture.cssPath, "\n.auth { padding: 2px; }\n");
        if (mode === "committed")
          await writeCompilation(
            await compileCatalogue(fixture.config),
            fixture.config,
          );
        const live = await computeCatalogueChanges(
          fixture.config,
          "HEAD",
          fixture.repository,
        );
        await exportCatalogue(fixture.config, { outDir: "site", base: "HEAD" });
        const exported = await readMembership(path.join(fixture.root, "site"));
        for (const [route, changes] of exported) {
          const expected = live.changedRoutes.includes(route);
          assert.equal(
            changes.included,
            expected,
            `export ${route}: ${changes.kind}`,
          );
          assert.equal(
            changes.kind === "unmodified",
            !expected,
            `export ${route}`,
          );
        }
        const publishedDir = path.join(fixture.root, ".context/published");
        await buildPreview(fixture.config, publishedDir, {
          includeChanges: true,
          base: "HEAD",
        });
        const published = await readMembership(publishedDir);
        for (const [route, changes] of exported) {
          assert.deepEqual(
            published.get(route),
            changes,
            `publication ${route}`,
          );
        }
      },
    );
  }
