import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { repositoryRoot } from "./fixture.js";
import {
  framePackageReport,
  modelPackageReport,
  uiPackageReport,
  viewerPackageReport,
  type PackageReport,
} from "./release_fixture.js";
import { isolatedGitEnvironment } from "./source_tree_types.js";

const execute = promisify(execFile);

export interface BootstrapReport extends PackageReport {
  filename: string;
  sourceCommit: string;
  sourceTree: string;
}

interface BootstrapModule {
  createBootstrapArchive(options: {
    repositoryRoot: string;
    expectedCommit: string;
    destination: string;
    packageName?: string;
  }): Promise<{ archivePath: string; report: BootstrapReport }>;
}

export async function bootstrapModule(): Promise<BootstrapModule> {
  return (await import(
    pathToFileURL(
      path.join(repositoryRoot, "scripts/release/bootstrap_archive.mjs"),
    ).href
  )) as BootstrapModule;
}

export async function bootstrapFixture(
  t: { after(fn: () => Promise<void>): void },
  options: { name?: string; version?: string; afterBuild?: string } = {},
) {
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-bootstrap-test-"),
  );
  t.after(() => fs.rm(temporaryRoot, { force: true, recursive: true }));
  const root = path.join(temporaryRoot, "repository");
  const destination = path.join(temporaryRoot, "artifact");
  await fs.mkdir(root);
  const packageJson = {
    name: options.name ?? "@mokly/mokly",
    version: options.version ?? "0.8.0",
    type: "module",
    license: "MIT",
    private: true,
    workspaces: [
      "packages/ui",
      "packages/model",
      "packages/frame",
      "packages/viewer",
    ],
    devDependencies: {
      "@mokly/ui": "0.16.1",
      "@mokly/model": "0.18.0",
      "@mokly/frame": "0.18.0",
      "@mokly/viewer": "0.1.0",
    },
    scripts: { prepack: "node build.mjs" },
  };
  const viewerPackage = {
    name: "@mokly/viewer",
    version: "0.1.0",
    license: "MIT",
    type: "module",
    files: ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
    scripts: { build: "node ../../build.mjs viewer", prepack: "npm run build" },
  };
  const uiPackage = {
    name: "@mokly/ui",
    version: "0.16.1",
    license: "MIT",
    type: "module",
    files: ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
    scripts: { build: "node ../../build.mjs ui", prepack: "npm run build" },
  };
  const modelPackage = {
    name: "@mokly/model",
    version: "0.18.0",
    license: "MIT",
    type: "module",
    files: ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
    scripts: { build: "node ../../build.mjs model", prepack: "npm run build" },
  };
  const framePackage = {
    name: "@mokly/frame",
    version: "0.18.0",
    license: "MIT",
    type: "module",
    files: ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
    dependencies: { "@mokly/model": "0.18.0" },
    scripts: { build: "node ../../build.mjs frame", prepack: "npm run build" },
  };
  const distFiles = [
    ...modelPackageReport()
      .files.filter((file) => file.path.startsWith("dist/"))
      .map((file) => `packages/model/${file.path}`),
    ...framePackageReport()
      .files.filter((file) => file.path.startsWith("dist/"))
      .map((file) => `packages/frame/${file.path}`),
    ...viewerPackageReport()
      .files.filter((file) => file.path.startsWith("dist/"))
      .map((file) => `packages/viewer/${file.path}`),
    ...uiPackageReport()
      .files.filter((file) => file.path.startsWith("dist/"))
      .map((file) => `packages/ui/${file.path}`),
  ];
  for (const [name, content] of Object.entries({
    "package.json": JSON.stringify(packageJson),
    "package-lock.json": JSON.stringify({
      name: packageJson.name,
      version: packageJson.version,
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": packageJson,
        "packages/ui": uiPackage,
        "packages/model": modelPackage,
        "packages/frame": framePackage,
        "packages/viewer": viewerPackage,
        "node_modules/@mokly/ui": { resolved: "packages/ui", link: true },
        "node_modules/@mokly/model": { resolved: "packages/model", link: true },
        "node_modules/@mokly/frame": { resolved: "packages/frame", link: true },
        "node_modules/@mokly/viewer": {
          resolved: "packages/viewer",
          link: true,
        },
      },
    }),
    "packages/model/package.json": JSON.stringify(modelPackage),
    "packages/model/README.md": "# Model package release fixture\n",
    "packages/model/LICENSE": "MIT\n",
    "packages/model/CHANGELOG.md": "# Model package test release\n",
    "packages/frame/package.json": JSON.stringify(framePackage),
    "packages/frame/README.md": "# Frame package release fixture\n",
    "packages/frame/LICENSE": "MIT\n",
    "packages/frame/CHANGELOG.md": "# Frame package test release\n",
    "packages/ui/package.json": JSON.stringify(uiPackage),
    "packages/ui/README.md": "# UI package release fixture\n",
    "packages/ui/LICENSE": "MIT\n",
    "packages/ui/CHANGELOG.md": "# UI package test release\n",
    "packages/viewer/package.json": JSON.stringify(viewerPackage),
    "packages/viewer/README.md": "# Viewer release fixture\n",
    "packages/viewer/LICENSE": "MIT\n",
    "packages/viewer/CHANGELOG.md": "# Viewer test release\n",
    ".gitignore": "dist/\nnode_modules/\n.context/\n",
    "README.md": "# Bootstrap test fixture\n",
    LICENSE: "MIT\n",
    "CHANGELOG.md": "# Test release\n",
    "source.txt": "reviewed source\n",
    "build.mjs": `import fs from "node:fs/promises";
import path from "node:path";
process.chdir(import.meta.dirname);
const workspace = process.argv[2];
if (workspace === "frame") await fs.access("packages/model/dist/index.d.ts");
const source = await fs.readFile("source.txt", "utf8");
for (const file of ${JSON.stringify(distFiles)}) {
  if (workspace && !file.startsWith(\`packages/\${workspace}/\`)) continue;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, source);
}
${options.afterBuild ?? ""}`,
  })) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content);
  }
  const env = await isolatedGitEnvironment(
    path.join(temporaryRoot, "global.gitconfig"),
  );
  const git = async (...args: string[]) =>
    (await execute("git", args, { cwd: root, env })).stdout.trim();
  await git("init", "--initial-branch=main");
  await git("config", "user.email", "bootstrap-test@example.com");
  await git("config", "user.name", "Bootstrap Test");
  await git("add", "-A");
  await git(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "test: reviewed bootstrap source",
  );
  const expectedCommit = await git("rev-parse", "HEAD");
  return { root, destination, expectedCommit, git };
}
