/**
 * A Git-backed comparison catalogue for browser specs: its baseline entries are
 * committed, then the changed entries are written, so Serve and export offer
 * comparisons for every changed screen and variant. Each spec family owns its
 * definition, so the shared comparison fixtures keep their classified counts.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { compileCatalogue } from "../../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import { exportCatalogue } from "../../packages/mokly/dist/export/run.js";
import { serve } from "../../packages/mokly/dist/server/serve.js";

import { createFixture, removeFixture, type TestFixture } from "./fixture.js";
import { waitForClassifiedCount } from "./watched_catalogue.js";

/** The entries, resources and stylesheets of one comparison catalogue. */
export interface ComparisonCatalogue {
  /** Changed screens and variants the classified catalogue reports. */
  changedCount: number;
  /** Resources written beside the entries, keyed by file name. */
  files: Readonly<Record<string, string>>;
  /** The entry module before (`false`) and after (`true`) the change. */
  source(changed: boolean): string;
  /** Resource file names every generated document links. */
  stylesheets: readonly string[];
}

async function createCatalogueFixture(
  definition: ComparisonCatalogue,
): Promise<TestFixture> {
  const linked = definition.stylesheets
    .map((name) => JSON.stringify(name))
    .join(", ");
  return createFixture(definition.source(false), {
    extraConfig: `stylesheets: [{ match: "**/*.html", stylesheets: [${linked}] }],`,
  });
}

/** Commit the baseline catalogue, then write the changed entries. */
async function commitBaseline(
  fixture: TestFixture,
  definition: ComparisonCatalogue,
) {
  for (const [name, contents] of Object.entries(definition.files))
    await fs.promises.writeFile(path.join(fixture.mockupsDir, name), contents);
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("add", ".");
  git("commit", "-qm", "test: comparison baseline");
  await fs.promises.writeFile(fixture.entryPath, definition.source(true));
  return config;
}

/** Serve a comparison catalogue against its real Git baseline. */
export async function serveComparisonCatalogue(
  definition: ComparisonCatalogue,
) {
  const fixture = await createCatalogueFixture(definition);
  try {
    const config = await commitBaseline(fixture, definition);
    const running = await serve(config, {
      base: "HEAD",
      port: 0,
      watch: false,
    });
    try {
      await waitForClassifiedCount(running.url, definition.changedCount);
    } catch (error) {
      await running.close();
      throw error;
    }
    return {
      url: running.url,
      async close() {
        await running.close();
        await removeFixture(fixture);
      },
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}

/** Export a comparison catalogue, with its packaged comparisons, to `site`. */
export async function exportComparisonCatalogue(
  definition: ComparisonCatalogue,
) {
  const fixture = await createCatalogueFixture(definition);
  try {
    const config = await commitBaseline(fixture, definition);
    await exportCatalogue(config, { base: "HEAD", outDir: "site" });
    return {
      output: path.join(fixture.root, "site"),
      close: () => removeFixture(fixture),
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}
