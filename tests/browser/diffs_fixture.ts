import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { compileCatalogue } from "../../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import { serve } from "../../packages/mokly/dist/server/serve.js";
import { comparisonEntrySource } from "../helpers/comparison_source.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { waitForClassifiedCount } from "../helpers/watched_catalogue.js";

/** Real Git-backed comparison server with changed, added, removed, and light-only screens. */
export async function comparisonFixture() {
  const fixture = await createFixture(comparisonEntrySource(false), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("add", ".");
  git("commit", "-qm", "test: baseline");
  await fs.promises.writeFile(fixture.entryPath, comparisonEntrySource(true));
  const running = await serve(config, { base: "HEAD", port: 0, watch: false });
  try {
    await waitForClassifiedCount(running.url, 3);
  } catch (error) {
    await running.close();
    await removeFixture(fixture);
    throw error;
  }
  return {
    ...fixture,
    outDir: config.review.outDir,
    url: running.url,
    async close() {
      await running.close();
      await removeFixture(fixture);
    },
  };
}
