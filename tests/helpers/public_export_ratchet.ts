import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface PublicExportFixtureOptions {
  exports?: Readonly<Record<string, unknown>>;
  notes?: string;
  packagePath?: string;
  sources?: Readonly<Record<string, string>>;
  tag?: string | null;
  version?: string;
}

export interface PublicExportFixture {
  root: string;
}

const defaultExports = {
  ".": {
    import: "./dist/index.js",
    types: "./dist/index.d.ts",
  },
};

/** Create a tagged package repository for public-export ratchet tests. */
export async function createPublicExportFixture(
  options: PublicExportFixtureOptions = {},
): Promise<PublicExportFixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-exports-"));
  const packagePath = options.packagePath ?? ".";
  await Promise.all([
    fs.mkdir(path.join(root, "docs/protocol"), { recursive: true }),
    fs.mkdir(path.join(root, packagePath, "src"), { recursive: true }),
  ]);
  await Promise.all([
    writeJson(root, "release-please-config.json", {
      packages: {
        [packagePath]: {
          "include-component-in-tag": false,
          "include-v-in-tag": true,
          "release-type": "node",
        },
      },
    }),
    writeJson(root, ".release-please-manifest.json", {
      [packagePath]: options.version ?? "1.0.0",
    }),
    writePackageExports(root, options.exports ?? defaultExports, packagePath),
    writeNotes(root, options.notes ?? "# Release notes\n"),
    ...Object.entries(
      options.sources ?? {
        [path.posix.join(packagePath, "src/index.ts")]:
          "export const kept = 1;\n",
      },
    ).map(([file, source]) => writeFile(root, file, source)),
  ]);
  git(root, "init", "--quiet", "--initial-branch=feature");
  git(root, "config", "user.name", "Ratchet Tests");
  git(root, "config", "user.email", "ratchets@example.invalid");
  commitFixture(root, "test: release package");
  const tag = options.tag === undefined ? "v1.0.0" : options.tag;
  if (tag) git(root, "tag", tag);
  return { root };
}

/** Replace the fixture package export map. */
export async function writePackageExports(
  root: string,
  exports: Readonly<Record<string, unknown>>,
  packagePath = ".",
): Promise<void> {
  await writeJson(root, path.posix.join(packagePath, "package.json"), {
    name: "@fixture/package",
    type: "module",
    version: "1.0.0",
    exports,
  });
}

/** Replace the fixture release-note document. */
export async function writeNotes(root: string, source: string): Promise<void> {
  await writeFile(root, "docs/protocol/npm-release-notes.md", source);
}

/** Replace one repository-relative fixture source. */
export async function writeSource(
  root: string,
  file: string,
  source: string,
): Promise<void> {
  await writeFile(root, file, source);
}

/** Replace the release-manifest version for the fixture package. */
export async function writeReleaseVersion(
  root: string,
  version: string,
): Promise<void> {
  await writeJson(root, ".release-please-manifest.json", { ".": version });
}

/** Commit every fixture change. */
export function commitFixture(root: string, message: string): void {
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", message);
}

/** Run a read-only or fixture-local Git command. */
export function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

async function writeJson(
  root: string,
  file: string,
  value: unknown,
): Promise<void> {
  await writeFile(root, file, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFile(
  root: string,
  file: string,
  source: string,
): Promise<void> {
  const absolute = path.join(root, file);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, source);
}
