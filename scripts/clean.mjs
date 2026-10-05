import fs from "node:fs";
import path from "node:path";

import { CLI_PACKAGE_PATH, cliPackageRoot } from "./package/layout.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageRoot = cliPackageRoot(repositoryRoot);
await fs.promises.rm(path.join(packageRoot, "dist"), {
  force: true,
  recursive: true,
});

if (CLI_PACKAGE_PATH !== ".")
  await fs.promises.rm(path.join(packageRoot, "docs"), {
    force: true,
    recursive: true,
  });

await fs.promises.rm(path.join(repositoryRoot, "packages/viewer/dist"), {
  force: true,
  recursive: true,
});
