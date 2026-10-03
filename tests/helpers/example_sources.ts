import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { repositoryRoot } from "./fixture.js";

/** Copy the authored example and CSS package without reusing generated output. */
export async function copyExampleSources(root: string): Promise<void> {
  const generated = path.join(repositoryRoot, "examples/basic/generated");
  const { stdout } = await promisify(execFile)(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "examples/basic/generated",
    ],
    { cwd: repositoryRoot },
  );
  const authored = stdout
    .split("\0")
    .filter(Boolean)
    .map((file) => path.resolve(repositoryRoot, file));
  for (const name of ["examples/basic", "docs/protocol", "README.md"])
    await fs.cp(path.join(repositoryRoot, name), path.join(root, name), {
      recursive: true,
      filter: (source) =>
        ![".context", ".mokly-cache", "node_modules", ".git"].includes(
          path.basename(source),
        ) &&
        source !== path.join(generated, "mokly-generated") &&
        (!source.startsWith(generated + path.sep) ||
          authored.some(
            (file) => file === source || file.startsWith(source + path.sep),
          )) &&
        !(
          source.startsWith(generated + path.sep) &&
          (source.endsWith(".html") ||
            [
              "mockbook-manifest.json",
              "mokabook-manifest.json",
              "mokly-manifest.json",
            ].includes(path.basename(source)))
        ),
    });
  await fs.cp(
    path.join(repositoryRoot, "node_modules/tailwindcss"),
    path.join(root, "node_modules/tailwindcss"),
    { recursive: true },
  );
}
