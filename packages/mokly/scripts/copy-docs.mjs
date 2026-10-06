import fs from "node:fs/promises";
import path from "node:path";

/** Replace derived package docs with the two canonical repository trees. */
export async function copyPackageDocs(repositoryRoot, packageRoot) {
  const target = path.join(packageRoot, "docs");
  if (path.resolve(repositoryRoot) === path.resolve(packageRoot))
    throw new Error("Copied documentation must belong to a workspace package");
  await fs.rm(target, { recursive: true, force: true });
  for (const name of ["guides", "protocol"])
    await fs.cp(
      path.join(repositoryRoot, "docs", name),
      path.join(target, name),
      {
        recursive: true,
      },
    );
}
