import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

import { createFixture, removeFixture, repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

/** Valid baseline image bytes used to prove binary historical delivery. */
export const REMOVED_BASELINE_IMAGE_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const REMOVED_BRANCH_EDIT_IMAGE_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8AARQMBggF/lWQAAAAASUVORK5CYII=",
  "base64",
);

/** Real Git fixture with removed content, ancestors, assets and prior branch edits. */
export async function createRemovedDeliveryFixture() {
  const fixture = await createFixture(removedDeliverySource(false));
  try {
    await writeRemovedAssets(fixture.mockupsDir, "baseline");
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

    await fs.writeFile(
      fixture.entryPath,
      removedDeliverySource(false, "branch-edit"),
    );
    await writeRemovedAssets(fixture.mockupsDir, "branch-edit");
    await writeCompilation(await compileCatalogue(config), config);
    await git("add", "entries", "mockups");
    await git("commit", "-qm", "test: edit removed content before deletion");
    const branchEditCommit = (await git("rev-parse", "HEAD")).stdout.trim();

    await fs.writeFile(fixture.entryPath, removedDeliverySource(true));
    await writeCompilation(await compileCatalogue(config), config);
    await fs.rm(path.join(fixture.mockupsDir, "assets/page.css"));
    await fs.rm(path.join(fixture.mockupsDir, "assets/nested.css"));
    await fs.rm(path.join(fixture.mockupsDir, "assets/past.png"));
    return {
      ...fixture,
      baseCommit,
      branchEditCommit,
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
): Promise<string> {
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
  entriesDir: "../../entries",
  mockupsDir: "../../mockups",
  repoRoot: "../..",
  review: { outDir: ".review", sharedImpact: [] }
});
`,
  );
  await fs.writeFile(fixture.entryPath, removedDeliverySource(false));
  await writeRemovedAssets(fixture.mockupsDir, "baseline");
  const config = await loadConfig(fixture.root, configPath);
  await writeCompilation(await compileCatalogue(config), config);
  await fixture.git(
    "add",
    "examples/basic/mokly.config.ts",
    "entries",
    "mockups",
  );
  await fixture.git("commit", "-qm", "test: preview entrypoint baseline");
  const baseCommit = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
  await fixture.git("update-ref", "refs/remotes/origin/main", baseCommit);
  await fs.writeFile(
    fixture.entryPath,
    removedDeliverySource(false, "branch-edit"),
  );
  await writeRemovedAssets(fixture.mockupsDir, "branch-edit");
  await writeCompilation(await compileCatalogue(config), config);
  await fixture.git("add", "entries", "mockups");
  await fixture.git(
    "commit",
    "-qm",
    "test: edit preview content before deletion",
  );
  await fs.writeFile(fixture.entryPath, removedDeliverySource(true));
  await writeCompilation(await compileCatalogue(config), config);
  await Promise.all(
    ["page.css", "nested.css", "past.png"].map((name) =>
      fs.rm(path.join(fixture.mockupsDir, "assets", name)),
    ),
  );
  return baseCommit;
}

async function writeRemovedAssets(
  mockupsDir: string,
  version: "baseline" | "branch-edit",
): Promise<void> {
  await fs.mkdir(path.join(mockupsDir, "assets"), { recursive: true });
  await fs.writeFile(
    path.join(mockupsDir, "assets/page.css"),
    '@import "./nested.css"; body { background: url("./past.png"); }',
  );
  await fs.writeFile(
    path.join(mockupsDir, "assets/nested.css"),
    version === "baseline"
      ? "main { color: rebeccapurple; }"
      : "main { color: tomato; }",
  );
  await fs.writeFile(
    path.join(mockupsDir, "assets/past.png"),
    version === "baseline"
      ? REMOVED_BASELINE_IMAGE_BYTES
      : REMOVED_BRANCH_EDIT_IMAGE_BYTES,
  );
}

export function removedDeliverySource(
  current: boolean,
  version: "baseline" | "branch-edit" = "baseline",
): string {
  const prefix = version === "baseline" ? "Previous" : "Branch edit";
  return `import React from "react";
import { defineCollection, definePage, defineScreen } from "@mokly/mokly";
const metadata = { description: "Fixture", dependencies: [], relatedDocs: [] };
export const mockups = [
  defineCollection({ ...metadata, id: "fixture", title: "Fixture", childIds: ["current"${current ? "" : ', "removed-archive"'}] }),
  ${current ? "" : 'defineCollection({ ...metadata, id: "removed-archive", title: "Deleted archive", childIds: ["removed-section"] }),\n  defineCollection({ ...metadata, id: "removed-section", title: "Deleted section", childIds: ["removed-screen", "removed-page"] }),'}
  defineScreen({ ...metadata, id: "current", title: "Current", route: "screens/current.html", mobile: <main>Current mobile</main>, desktop: <main>Current desktop</main>, useCaseIds: [] }),
  ${
    current
      ? ""
      : `defineScreen({ ...metadata, id: "removed-screen", title: "Removed screen", route: "screens/removed.html", mobile: <main>${prefix} mobile screen</main>, desktop: <main>${prefix} desktop screen</main>, useCaseIds: [] }),
  definePage({ ...metadata, id: "removed-page", title: "Removed page", route: "archive/removed.html", render: () => '<!doctype html><html><head><link rel="stylesheet" href="../assets/page.css"></head><body><main>${prefix} page</main><img src="../assets/past.png"></body></html>' }),`
  }
];`;
}
