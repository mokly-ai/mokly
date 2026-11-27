import fs from "node:fs/promises";
import path from "node:path";

import { currentDocumentPath, type EntryDetailV4 } from "@mokly/model";

import { runCaptured } from "../../scripts/verification/process.mjs";

import { repositoryRoot } from "./fixture.js";
import { timeFixturePhase } from "./fixture_timing.js";
import { json } from "./static_changes.js";

/** Build real published documents through the same shim used by consumers. */
export async function buildStaticCatalogue(
  cwd: string,
  output: string,
  signal?: AbortSignal,
): Promise<void> {
  await timeFixturePhase(
    "browser-catalogue",
    "static-build",
    false,
    async () => {
      const result = await runCaptured(
        process.execPath,
        [
          path.join(repositoryRoot, "packages/mokly/bin/mokly.mjs"),
          "build",
          "--no-changes",
          "--out",
          output,
          "--sidecars",
          "1",
        ],
        { cwd, ...(signal ? { signal } : {}) },
      );
      if (result.exitCode !== 0 || result.signal || result.interrupted)
        throw new Error(
          `Fixture build failed: ${result.stderr}\n${result.stdout}`,
        );
    },
  );
}

/** Build the failed story and add its generated documents to the served fixture. */
export async function buildFailedStoryCatalogue(cwd: string, served: string) {
  const output = path.join(cwd, "failed-story-site");
  await fs.writeFile(
    path.join(cwd, "specs", "Broken.stories.tsx"),
    `export default { title: "Failed story" };
export const Broken = {
  render() { throw new Error("The menu is unavailable"); },
};`,
  );
  await buildStaticCatalogue(cwd, output);
  const detail = await json<EntryDetailV4>(
    output,
    "mokly-viewer/entries/Broken.json",
  );
  const documents = currentDocumentPath(detail.entry.path);
  await fs.cp(path.join(output, documents), path.join(served, documents), {
    recursive: true,
  });
  return detail;
}
