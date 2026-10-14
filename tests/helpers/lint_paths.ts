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
export const directoryRoots = ["packages/viewer/src/"];

/** One matching extension per folder, including folders whose files need no literals. */
export const directoryProbes = [
  ...new Set(
    sourceFiles
      .flatMap((file) => {
        const root = directoryRoots.find((root) => file.startsWith(root));
        const extension = path.posix.extname(file);
        if (!root || ![".ts", ".tsx"].includes(extension)) return [];
        return [`${path.posix.dirname(file)}/lint-coverage-probe${extension}`];
      })
      .concat(["packages/viewer/src/lint-coverage-probe.tsx"]),
  ),
].sort();
