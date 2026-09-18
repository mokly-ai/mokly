import fs from "node:fs/promises";
import path from "node:path";

/** Default, case-folded and consumer exclusions exercised at public boundaries. */
export const excludedNames = [
  "README",
  "README.md",
  "readme.txt",
  "nested/readme.md",
  "tsconfig.json",
  "tsconfig.build.json",
  "nested/tsconfig.mokly.json",
  ".hidden/ReAdMe.MD",
  "nested/README",
  "nested/TSCONFIG.JSON",
  "internal/private.json",
  "internal/.private.json",
];

/** Ordinary resource names remain public without a matching consumer glob. */
export const permittedNames = [
  "styles.css",
  "image.png",
  "page.html",
  "data.json",
];

/** Create actual resources without adding them to the authoring import graph. */
export async function writeExclusionFiles(root: string): Promise<void> {
  for (const name of [...excludedNames, ...permittedNames]) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(
      path.join(root, name),
      name.endsWith(".json") ? "{}" : "fixture",
    );
  }
}
