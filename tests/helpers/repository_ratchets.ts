/** Shared Git fixtures for repository and test helper export ratchets. */

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runRepositoryRatchets } from "../../scripts/verification/repository-ratchets.mjs";

const legacyModule =
  "export const knownUnused = 1;\n" + "void 0;\n".repeat(300);
const longProtocolDocument =
  "# Long contract\n" + "contract line\n".repeat(250);

/** Create a branch whose merge base stays fixed when origin/main advances. */
export async function createDivergedRepository(
  options: { bootstrapTestHelpers?: boolean } = {},
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-ratchets-"));
  await Promise.all([
    fs.mkdir(path.join(root, "docs/protocol"), { recursive: true }),
    fs.mkdir(path.join(root, "docs/protocol/fixtures"), { recursive: true }),
    fs.mkdir(path.join(root, "packages/viewer"), { recursive: true }),
    fs.mkdir(path.join(root, "scripts"), { recursive: true }),
    fs.mkdir(path.join(root, "xtask"), { recursive: true }),
    fs.mkdir(path.join(root, "tests/helpers"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(
      path.join(root, "package.json"),
      '{ "name": "ratchet-fixture", "exports": {} }\n',
    ),
    fs.writeFile(
      path.join(root, "release-please-config.json"),
      '{ "packages": { ".": {}, "packages/viewer": {} } }\n',
    ),
    fs.writeFile(
      path.join(root, ".release-please-manifest.json"),
      '{ ".": "0.0.0", "packages/viewer": "0.0.0" }\n',
    ),
    fs.writeFile(
      path.join(root, "packages/viewer/package.json"),
      '{ "name": "ratchet-viewer-fixture", "exports": {} }\n',
    ),
    fs.writeFile(
      path.join(root, "docs/protocol/npm-release-notes.md"),
      "# Release notes\n",
    ),
    fs.writeFile(path.join(root, "scripts/legacy.mjs"), legacyModule),
    fs.writeFile(
      path.join(root, "docs/protocol/long.md"),
      longProtocolDocument,
    ),
    fs.writeFile(
      path.join(root, "docs/protocol/fixtures/ignored.md"),
      "fixture line\n".repeat(400),
    ),
    fs.writeFile(
      path.join(root, "xtask/protocol-document-caps.json"),
      '{ "long.md": 251 }\n',
    ),
    fs.writeFile(
      path.join(root, "xtask/unused-internal-exports.txt"),
      "scripts/legacy.mjs#knownUnused\n",
    ),
    ...(!options.bootstrapTestHelpers
      ? [
          fs.writeFile(
            path.join(root, "xtask/unused-test-helper-exports.txt"),
            "",
          ),
        ]
      : []),
  ]);
  git(root, "init", "--quiet", "--initial-branch=feature");
  git(root, "config", "user.name", "Ratchet Tests");
  git(root, "config", "user.email", "ratchets@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", "test: branch point");
  const branchPoint = git(root, "rev-parse", "HEAD").trim();
  git(root, "branch", "main");
  await fs.writeFile(path.join(root, "feature.txt"), "feature branch\n");
  git(root, "add", "feature.txt");
  git(root, "commit", "--quiet", "-m", "test: feature work");
  git(root, "switch", "--quiet", "main");
  await Promise.all([
    fs.rm(path.join(root, "scripts/legacy.mjs")),
    fs.writeFile(
      path.join(root, "docs/protocol/long.md"),
      "# Shorter contract\n" + "contract line\n".repeat(249),
    ),
    fs.writeFile(path.join(root, "xtask/protocol-document-caps.json"), "{}\n"),
    fs.writeFile(path.join(root, "xtask/unused-internal-exports.txt"), ""),
  ]);
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", "test: advance main");
  git(root, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(root, "switch", "--quiet", "feature");
  if (options.bootstrapTestHelpers)
    await fs.writeFile(
      path.join(root, "xtask/unused-test-helper-exports.txt"),
      "",
    );
  return { branchPoint, root };
}

/** Run every ratchet and capture its diagnostics without changing assertions. */
export function captureRatchets(root: string) {
  const output: string[] = [];
  const original = console.error;
  console.error = (...values: unknown[]) => output.push(values.join(" "));
  try {
    const passed = runRepositoryRatchets(root);
    return { output: output.join("\n"), passed };
  } finally {
    console.error = original;
  }
}

/** Run a Git command only within an isolated fixture repository. */
export function git(root: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}
