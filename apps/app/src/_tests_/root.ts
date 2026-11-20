import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Where the repository is, for a test that reads a file the product ships
 * beside it.
 *
 * Found by looking upward for the workspace manifest rather than counted from
 * a fixed depth or assumed from the working directory, because the two runners
 * load these modules differently — one as ES modules, one transpiled — and a
 * runner started from anywhere should still find the same tree.
 */
function findRoot(): string {
  let at = resolve(process.cwd());
  for (;;) {
    if (existsSync(resolve(at, "Cargo.toml"))) return at;
    const up = dirname(at);
    if (up === at) {
      throw new Error(
        "[app/tests] no workspace manifest above " + process.cwd(),
      );
    }
    at = up;
  }
}

/** The repository root, resolved once. */
export const repositoryRoot = findRoot();
