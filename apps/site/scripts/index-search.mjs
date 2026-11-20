import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import * as pagefind from "pagefind";

/** @template {{ errors: string[] }} T @param {T} result @returns {T} */
function checked(result) {
  if (result.errors.length)
    throw new Error(`Pagefind: ${result.errors.join("; ")}`);
  return result;
}

const ENTRY = "pagefind-entry.json";
const MODULE = "pagefind.js";

/** @param {unknown} value @returns {number} */
function indexedPages(value) {
  if (!value || typeof value !== "object" || !("languages" in value)) return 0;
  const languages = value.languages;
  if (!languages || typeof languages !== "object") return 0;
  return Object.values(languages).reduce(
    (total, language) =>
      total +
      (language &&
      typeof language === "object" &&
      "page_count" in language &&
      typeof language.page_count === "number"
        ? language.page_count
        : 0),
    0,
  );
}

/**
 * Wait until Pagefind's asynchronous writer has made its browser entrypoints
 * readable. `writeFiles` can resolve while `pagefind-entry.json` is still
 * empty, so successful process exit must be a stronger readiness boundary.
 *
 * @param {string} outputPath
 * @param {number} expectedPages
 * @param {{ intervalMs?: number, timeoutMs?: number }} [options]
 */
export async function waitForSearchIndex(
  outputPath,
  expectedPages,
  { intervalMs = 10, timeoutMs = 5_000 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  /** @type {Error | undefined} */
  let lastError;
  do {
    try {
      const [entry, module] = await Promise.all([
        readFile(path.join(outputPath, ENTRY), "utf8"),
        readFile(path.join(outputPath, MODULE), "utf8"),
      ]);
      const pages = indexedPages(JSON.parse(entry));
      if (pages === expectedPages && module.length > 0) return;
      lastError = new Error(
        `Pagefind wrote ${pages} of ${expectedPages} pages or an empty module`,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await wait(intervalMs);
  } while (Date.now() < deadline);
  throw new Error(
    `Pagefind did not finish writing ${expectedPages} documentation pages`,
    { cause: lastError },
  );
}

async function main() {
  const root =
    process.argv[2] ?? fileURLToPath(new URL("../dist", import.meta.url));
  const { index } = checked(await pagefind.createIndex());
  if (!index) throw new Error("Pagefind did not create an index");
  const { page_count: count } = checked(
    await index.addDirectory({ path: root, glob: "docs/**/*.html" }),
  );
  if (count > 0) {
    const outputPath = path.join(root, "pagefind");
    checked(await index.writeFiles({ outputPath }));
    await waitForSearchIndex(outputPath, count);
  }
  process.stdout.write(`Pagefind: indexed ${count} documentation pages.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } finally {
    await pagefind.close();
  }
}
