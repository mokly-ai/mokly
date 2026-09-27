/**
 * A Git-backed repository for the comparison pane alignment specs, served live
 * or exported as a static artifact. It is dedicated to those specs, so the
 * shared comparison fixtures keep their classified counts.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { exportCatalogue } from "../../dist/export/run.js";
import { serve } from "../../dist/server/serve.js";

import {
  ALIGNMENT_CHANGED_COUNT,
  ALIGNMENT_LATE_IMAGE,
  ALIGNMENT_STYLES,
  comparisonAlignmentSource,
} from "./comparison_alignment_source.js";
import { createFixture, removeFixture, type TestFixture } from "./fixture.js";
import { waitForClassifiedCount } from "./watched_catalogue.js";

/** Commit the baseline catalogue, then write the changed entries. */
async function alignmentRepository(fixture: TestFixture) {
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "alignment.css"),
    ALIGNMENT_STYLES,
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "alignment-late.svg"),
    ALIGNMENT_LATE_IMAGE,
  );
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("add", ".");
  git("commit", "-qm", "test: alignment baseline");
  await fs.promises.writeFile(
    fixture.entryPath,
    comparisonAlignmentSource(true),
  );
  return config;
}

async function createAlignmentFixture(): Promise<TestFixture> {
  return createFixture(comparisonAlignmentSource(false), {
    extraConfig:
      'stylesheets: [{ match: "**/*.html", stylesheets: ["alignment.css"] }],',
  });
}

/** Serve the alignment catalogue against a real Git baseline. */
export async function comparisonAlignmentFixture() {
  const fixture = await createAlignmentFixture();
  try {
    const config = await alignmentRepository(fixture);
    const running = await serve(config, {
      base: "HEAD",
      port: 0,
      watch: false,
    });
    try {
      await waitForClassifiedCount(running.url, ALIGNMENT_CHANGED_COUNT);
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

/** Export the alignment catalogue, with its packaged comparisons, to `site`. */
export async function comparisonAlignmentExport() {
  const fixture = await createAlignmentFixture();
  try {
    const config = await alignmentRepository(fixture);
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
