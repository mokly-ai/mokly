import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { repositoryRoot } from "./fixture.js";
import {
  packageReport,
  viewerPackageReport,
  type PackageReport,
} from "./release_fixture.js";

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
    bin: { mokly: "./dist/cli/bin.js" },
    workspaces: ["packages/viewer"],
    dependencies: { "@mokly/viewer": "0.1.0" },
    files: ["dist", "docs/protocol", "README.md", "LICENSE", "CHANGELOG.md"],
    scripts: { prepack: "node build.mjs" },
  };
  const viewerPackage = {
    name: "@mokly/viewer",
    version: "0.1.0",
    license: "MIT",
    type: "module",
    files: ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
    scripts: { prepack: "node ../../build.mjs" },
  };
  const distFiles = packageReport()
    .files.map((file) => file.path)
    .filter((file) => file.startsWith("dist/"))
    .concat(
      viewerPackageReport()
        .files.filter((file) => file.path.startsWith("dist/"))
        .map((file) => `packages/viewer/${file.path}`),
    );
  for (const [name, content] of Object.entries({
    "package.json": JSON.stringify(packageJson),
    "package-lock.json": JSON.stringify({
      name: packageJson.name,
      version: packageJson.version,
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": packageJson,
        "packages/viewer": viewerPackage,
        "node_modules/@mokly/viewer": {
          resolved: "packages/viewer",
          link: true,
        },
      },
    }),
    "packages/viewer/package.json": JSON.stringify(viewerPackage),
    "packages/viewer/README.md": "# Viewer release fixture\n",
    "packages/viewer/LICENSE": "MIT\n",
    "packages/viewer/CHANGELOG.md": "# Viewer test release\n",
    ".gitignore": "dist/\nnode_modules/\n.context/\n",
    "README.md": "# Bootstrap test fixture\n",
    "docs/protocol/mokly-upload.md": "# Upload protocol test fixture\n",
    "docs/protocol/mokly-export-ownership.md":
      "# Ownership protocol test fixture\n",
    "docs/protocol/fixtures/export-ownership-v1.json":
      '{"schemaVersion":1,"cases":[]}\n',
    "docs/protocol/mokly-frame-adapter.md": "# Frame protocol test fixture\n",
    "docs/protocol/mokly-catalogue.md": "# Catalogue protocol test fixture\n",
    "docs/protocol/fixtures/catalogue-v1.json": '{"schemaVersion":1}\n',
    LICENSE: "MIT\n",
    "CHANGELOG.md": "# Test release\n",
    "source.txt": "reviewed source\n",
    "build.mjs": `import fs from "node:fs/promises";
import path from "node:path";
process.chdir(import.meta.dirname);
const source = await fs.readFile("source.txt", "utf8");
for (const file of ${JSON.stringify(distFiles)}) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, source);
}
${options.afterBuild ?? ""}`,
  })) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content);
  }
  const git = async (...args: string[]) =>
    (await execute("git", args, { cwd: root })).stdout.trim();
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
