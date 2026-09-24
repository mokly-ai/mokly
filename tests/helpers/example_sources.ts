import fs from "node:fs/promises";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

/** Copy the real example's authored inputs without reusing local generated output. */
export async function copyExampleSources(root: string): Promise<void> {
  for (const name of ["examples/basic", "docs/protocol", "README.md"])
    await fs.cp(path.join(repositoryRoot, name), path.join(root, name), {
      recursive: true,
      filter: (source) =>
        ![
          ".context",
          ".mokly-cache",
          "node_modules",
          ".git",
          ".generated",
          "generated",
        ].includes(path.basename(source)),
    });
}
