import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
await fs.promises.rm(path.join(repositoryRoot, "dist"), {
  force: true,
  recursive: true,
});

await fs.promises.rm(path.join(repositoryRoot, "packages/viewer/dist"), {
  force: true,
  recursive: true,
});
