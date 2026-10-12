import fs from "node:fs/promises";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { readBaseManifest } from "../../dist/review/base_manifest.js";

import { committedReviewRepository } from "./committed_repository.js";
import type { inlineChangesFixture } from "./inline_changes.js";

export async function pageFixtureInput(
  fixture: Awaited<ReturnType<typeof inlineChangesFixture>>,
  mode: "committed" | "derived",
) {
  const config = fixture.config;
  const repository = committedReviewRepository(fixture.config);
  const commit = await repository.evidence.mergeBase("main", "HEAD");
  const before = await readBaseManifest(repository.reader, commit, config);
  const after = await compileCatalogue(config);
  const routes = fixture
    .git("ls-tree", "-r", "--name-only", commit, "--", "mockups")
    .toString()
    .trim()
    .split("\n");
  const beforeFiles = new Map(
    await Promise.all(
      routes.map(
        async (route) =>
          [
            route.slice("mockups/".length),
            await repository.reader.readFileBytes(commit, route),
          ] as const,
      ),
    ),
  );
  const afterFiles = new Map<string, string | Uint8Array>();
  for (const route of await fs.readdir(config.mockupsDir, {
    recursive: true,
  })) {
    const absolute = path.join(config.mockupsDir, route);
    if ((await fs.stat(absolute)).isFile())
      afterFiles.set(route, await fs.readFile(absolute));
  }
  for (const [route, content] of after.outputs)
    afterFiles.set(`mokly-generated/${route}`, content);
  const outputs = new Set(
    [...after.outputs.keys()].map(
      (route) => `mockups/mokly-generated/${route}`,
    ),
  );
  const changedPaths = (await repository.evidence.changedPaths(commit)).filter(
    (route) => mode === "committed" || !outputs.has(route),
  );
  return {
    before,
    after: after.manifest,
    config,
    beforeFiles,
    afterFiles,
    changedPaths,
  };
}
