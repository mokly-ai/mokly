import path from "node:path";
import { fileURLToPath } from "node:url";

import * as pagefind from "pagefind";

/** @template {{ errors: string[] }} T @param {T} result @returns {T} */
function checked(result) {
  if (result.errors.length)
    throw new Error(`Pagefind: ${result.errors.join("; ")}`);
  return result;
}

try {
  const root =
    process.argv[2] ?? fileURLToPath(new URL("../dist", import.meta.url));
  const { index } = checked(await pagefind.createIndex());
  if (!index) throw new Error("Pagefind did not create an index");
  const { page_count: count } = checked(
    await index.addDirectory({ path: root, glob: "docs/**/*.html" }),
  );
  if (count > 0) {
    checked(
      await index.writeFiles({ outputPath: path.join(root, "pagefind") }),
    );
  }
  process.stdout.write(`Pagefind: indexed ${count} documentation pages.\n`);
} finally {
  await pagefind.close();
}
