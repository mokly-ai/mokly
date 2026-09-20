import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

import { createFixture, removeFixture, repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

/** Real Git fixture with one removed page, one removed screen, and deleted assets. */
export async function createRemovedDeliveryFixture() {
  const fixture = await createFixture(removedDeliverySource(false));
  try {
    await fs.mkdir(path.join(fixture.mockupsDir, "assets"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(fixture.mockupsDir, "assets/page.css"),
      '@import "./nested.css"; body { background: url("./past.png"); }',
    );
    await fs.writeFile(
      path.join(fixture.mockupsDir, "assets/nested.css"),
      "main { color: rebeccapurple; }",
    );
    await fs.writeFile(
      path.join(fixture.mockupsDir, "assets/past.png"),
      Uint8Array.from([0, 17, 34, 51, 68]),
    );
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const git = (...args: string[]) =>
      execute("git", args, { cwd: fixture.root });
    await git("init", "-q", "-b", "main");
    await git("config", "user.email", "test@example.invalid");
    await git("config", "user.name", "Test");
    await git("add", ".");
    await git("commit", "-qm", "test: removed preview baseline");
    const baseCommit = (await git("rev-parse", "HEAD")).stdout.trim();
    await git("update-ref", "refs/remotes/origin/main", baseCommit);

    await fs.writeFile(fixture.entryPath, removedDeliverySource(true));
    await writeCompilation(await compileCatalogue(config), config);
    await fs.rm(path.join(fixture.mockupsDir, "assets/page.css"));
    await fs.rm(path.join(fixture.mockupsDir, "assets/nested.css"));
    await fs.rm(path.join(fixture.mockupsDir, "assets/past.png"));
    return {
      ...fixture,
      baseCommit,
      config,
      git,
      output: path.join(fixture.root, "site"),
      close: () => removeFixture(fixture),
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}

/** Install the repository preview npm entrypoint over a committed removal fixture. */
export async function prepareRemovedPreviewEntrypoint(
  fixture: Awaited<ReturnType<typeof createRemovedDeliveryFixture>>,
): Promise<void> {
  const exampleRoot = path.join(fixture.root, "examples/basic");
  const configPath = path.join(exampleRoot, "mokly.config.ts");
  await fs.mkdir(exampleRoot, { recursive: true });
  await fs.cp(
    path.join(repositoryRoot, "scripts/preview"),
    path.join(fixture.root, "scripts/preview"),
    { recursive: true },
  );
  await fs.symlink(
    path.join(repositoryRoot, "dist"),
    path.join(fixture.root, "dist"),
  );
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(fixture.root, "node_modules"),
  );
  await fs.writeFile(
    path.join(fixture.root, "package.json"),
    `${JSON.stringify(
      {
        name: "removed-preview-entrypoint-fixture",
        private: true,
        scripts: { "preview:build": "node scripts/preview/build.mjs" },
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(
    configPath,
    `import { defineConfig } from "@mokly/mokly";
export default defineConfig({
  generatedOutput: "committed",
  entriesDir: "../../entries",
  mockupsDir: "../../mockups",
  repoRoot: "../..",
  review: { outDir: ".review", sharedImpact: [] }
});
`,
  );
  await fs.writeFile(fixture.entryPath, removedDeliverySource(false));
  await writeRemovedAssets(fixture.mockupsDir);
  const config = await loadConfig(fixture.root, configPath);
  await writeCompilation(await compileCatalogue(config), config);
  await fixture.git(
    "add",
    "examples/basic/mokly.config.ts",
    "entries",
    "mockups",
  );
  await fixture.git("commit", "-qm", "test: preview entrypoint baseline");
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await fs.writeFile(fixture.entryPath, removedDeliverySource(true));
  await writeCompilation(await compileCatalogue(config), config);
  await Promise.all(
    ["page.css", "nested.css", "past.png"].map((name) =>
      fs.rm(path.join(fixture.mockupsDir, "assets", name)),
    ),
  );
}

async function writeRemovedAssets(mockupsDir: string): Promise<void> {
  await fs.mkdir(path.join(mockupsDir, "assets"), { recursive: true });
  await fs.writeFile(
    path.join(mockupsDir, "assets/page.css"),
    '@import "./nested.css"; body { background: url("./past.png"); }',
  );
  await fs.writeFile(
    path.join(mockupsDir, "assets/nested.css"),
    "main { color: rebeccapurple; }",
  );
  await fs.writeFile(
    path.join(mockupsDir, "assets/past.png"),
    Uint8Array.from([0, 17, 34, 51, 68]),
  );
}

export function removedDeliverySource(current: boolean): string {
  return `import React from "react";
import { defineCollection, definePage, defineScreen } from "@mokly/mokly";
const metadata = { description: "Fixture", dependencies: [], relatedDocs: [] };
export const mockups = [
  defineCollection({ ...metadata, id: "fixture", title: "Fixture", childIds: ["current"${current ? "" : ', "removed-screen", "removed-page"'}] }),
  defineScreen({ ...metadata, id: "current", title: "Current", route: "screens/current.html", mobile: <main>Current mobile</main>, desktop: <main>Current desktop</main>, useCaseIds: [] }),
  ${
    current
      ? ""
      : 'defineScreen({ ...metadata, id: "removed-screen", title: "Removed screen", route: "screens/removed.html", mobile: <main>Previous mobile screen</main>, desktop: <main>Previous desktop screen</main>, useCaseIds: [] }),\n  definePage({ ...metadata, id: "removed-page", title: "Removed page", route: "archive/removed.html", render: () => \'<!doctype html><html><head><link rel="stylesheet" href="../assets/page.css"></head><body><main>Previous page</main><img src="../assets/past.png"></body></html>\' }),'
  }
];`;
}
