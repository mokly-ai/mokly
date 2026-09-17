import fs from "node:fs/promises";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

/** Copy the real example's authored inputs without reusing local generated output. */
export async function copyExampleSources(root: string): Promise<void> {
  const generated = path.join(repositoryRoot, "examples/basic/generated");
  for (const name of ["examples/basic", "docs/protocol", "README.md"])
    await fs.cp(path.join(repositoryRoot, name), path.join(root, name), {
      recursive: true,
      filter: (source) =>
        ![".context", ".mokly-cache", "node_modules", ".git"].includes(
          path.basename(source),
        ) &&
        !(
          source.startsWith(generated + path.sep) &&
          (source.endsWith(".html") ||
            ["mockbook-manifest.json", "mokly-manifest.json"].includes(
              path.basename(source),
            ))
        ),
    });
}
