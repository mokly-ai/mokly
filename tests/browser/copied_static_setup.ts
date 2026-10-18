import fs from "node:fs/promises";
import path from "node:path";

import { buildStaticCatalogue } from "../helpers/build_site.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { copiedHost } from "./copied_host.js";

/** A supplied example must have the same current-only contract as a fresh build. */
export function requireCurrentOnlyIndex(
  index: unknown,
  directory: string,
): void {
  if (
    !index ||
    typeof index !== "object" ||
    !("changesStatus" in index) ||
    index.changesStatus !== "disabled"
  ) {
    throw new Error(
      `Static browser catalogue ${directory} must have changesStatus "disabled"; build it with --no-changes`,
    );
  }
}

/** Each suite owns a fresh current-only copy, including in manual file mode. */
export async function startCopiedStaticHost(signal?: AbortSignal) {
  return copiedHost(
    "copied-static-",
    async (_source, built) => {
      const supplied =
        process.env["MOKLY_PLAYWRIGHT_STATIC_DIR"] ??
        process.env["MOKLY_PLAYWRIGHT_FILE_DIR"];
      if (supplied) {
        const directory = path.resolve(supplied);
        const index: unknown = JSON.parse(
          await fs.readFile(
            path.join(directory, "mokly-viewer/index.json"),
            "utf8",
          ),
        );
        requireCurrentOnlyIndex(index, directory);
        await fs.cp(directory, built, { recursive: true });
      } else {
        await buildStaticCatalogue(
          path.join(repositoryRoot, "examples/basic"),
          built,
          signal,
        );
      }
    },
    signal,
  );
}
