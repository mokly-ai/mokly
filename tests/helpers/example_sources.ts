import fs from "node:fs/promises";
import path from "node:path";

import { EXAMPLE_SOURCE_PATHS } from "../../scripts/verification/example-snapshot-key.mjs";

import { repositoryRoot } from "./fixture.js";

/** Copy the authored example and CSS package without reusing generated output. */
export async function copyExampleSources(root: string): Promise<void> {
  for (const name of EXAMPLE_SOURCE_PATHS)
    await fs.cp(path.join(repositoryRoot, name), path.join(root, name), {
      recursive: true,
      filter: (source) =>
        ![
          ".context",
          ".mokly-cache",
          "node_modules",
          ".git",
          "mokly-generated",
          "generated",
        ].includes(path.basename(source)),
    });
  await fs.cp(
    path.join(repositoryRoot, "node_modules/tailwindcss"),
    path.join(root, "node_modules/tailwindcss"),
    { recursive: true },
  );
}
