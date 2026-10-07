import { execFileSync } from "node:child_process";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

/** Include new source folders while respecting the repository's Git ignores. */
const sourceFiles = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: repositoryRoot, encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
];

/** Contract roots are independent of config contents so narrowed globs fail coverage. */
export const directoryRoots = [
  "src/",
  "packages/viewer/src/",
  "scripts/preview/",
];

/** One matching extension per folder, including folders whose files need no literals. */
export const directoryProbes = [
  ...new Set(
    sourceFiles
      .flatMap((file) => {
        const root = directoryRoots.find((root) => file.startsWith(root));
        const extension = path.posix.extname(file);
        if (
          !root ||
          !(root === "scripts/preview/"
            ? extension === ".mjs"
            : [".ts", ".tsx"].includes(extension))
        )
          return [];
        return [`${path.posix.dirname(file)}/lint-coverage-probe${extension}`];
      })
      .concat([
        "src/lint-coverage-probe.tsx",
        "packages/viewer/src/lint-coverage-probe.tsx",
        "scripts/preview/lint-coverage/nested/probe.mjs",
      ]),
  ),
].sort();

/** Recursive source-order scopes plus each exact-file rule and future nested folders. */
export const localeProbes = [
  ...new Set(
    sourceFiles
      .filter((file) =>
        /^(?:src\/config\/|src\/build\/styles\/).*\.ts$/u.test(file),
      )
      .map((file) => `${path.posix.dirname(file)}/lint-coverage-probe.ts`)
      .concat([
        "src/build/discovery.ts",
        "src/build/source_inventory.ts",
        "src/build/package_owned_paths.ts",
        "src/config/lint-coverage/nested/probe.ts",
        "src/build/styles/lint-coverage/nested/probe.ts",
      ]),
  ),
].sort();
