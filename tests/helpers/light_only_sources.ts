import fs from "node:fs/promises";
import path from "node:path";

import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { write } from "./static_changes.js";

/** Documents of the two copies whose catalogue colour schemes change. */
export const lightOnlyPaths = {
  currentDocument: "schemes/payment-terms",
  removedDocument: "schemes/old-terms",
} as const;

const terms = (title: string) =>
  `---\ntitle: ${title}\n---\n# ${title}\n\nEvery invoice is due 30 days after it is issued.\n`;

/** Set the catalogue's colour schemes for the commit that follows. */
async function colorSchemes(root: string, schemes: readonly string[]) {
  const file = path.join(root, "mokly.config.json");
  const config = JSON.parse(await fs.readFile(file, "utf8")) as object;
  await fs.writeFile(
    file,
    JSON.stringify({ ...config, colorSchemes: schemes }),
  );
}

/**
 * Light and Dark at the base, Light only now. Payment terms exists on both
 * sides, so it has a light page only, while the removed screens keep their
 * dark renders and the catalogue still offers Dark.
 */
export const addLightOnlyCurrentSources: ComparisonAdditions = async (
  root,
  side,
) => {
  await write(
    root,
    `specs/${lightOnlyPaths.currentDocument}.md`,
    terms("Payment terms"),
  );
  if (side === "After") await colorSchemes(root, ["light"]);
};

/**
 * Light only at the base, Light and Dark now. Old terms exists only at the
 * base, so its previous version has a light page only.
 */
export const addLightOnlyBaseSources: ComparisonAdditions = async (
  root,
  side,
) => {
  const removed = `specs/${lightOnlyPaths.removedDocument}.md`;
  if (side === "Before") {
    await colorSchemes(root, ["light"]);
    await write(root, removed, terms("Old terms"));
    return;
  }
  await colorSchemes(root, ["light", "dark"]);
  await fs.rm(path.join(root, removed));
};
