import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** Where the post-build step writes the documentation index. */
const INDEX = "pagefind";

/** The file the browser loads to search. */
const ENTRY = "pagefind-entry.json";

interface PagefindEntry {
  readonly languages?: Readonly<Record<string, { page_count?: number }>>;
}

async function documents(root: string, directory: string): Promise<number> {
  let found = 0;
  let entries;
  try {
    entries = await readdir(path.join(root, directory), {
      withFileTypes: true,
    });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const child = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) found += await documents(root, child);
    else if (entry.isFile() && entry.name.endsWith(".html")) found += 1;
  }
  return found;
}

/**
 * Check the search index the build wrote beside the documentation. Every
 * documentation page must be in it, and the module the search island loads
 * must exist, so a reader never opens search onto an index that is missing or
 * one build behind the pages.
 */
export async function checkSearch(root: string): Promise<number> {
  const pages = await documents(root, "docs");
  if (pages === 0) return 0;
  const entry = path.join(root, INDEX, ENTRY);
  let parsed: PagefindEntry;
  try {
    parsed = JSON.parse(await readFile(entry, "utf8")) as PagefindEntry;
  } catch {
    throw new Error(
      `site:links found ${pages} documentation pages and no search index at ${INDEX}/${ENTRY}`,
    );
  }
  await readFile(path.join(root, INDEX, "pagefind.js"), "utf8");
  const indexed = Object.values(parsed.languages ?? {}).reduce(
    (total, language) => total + (language.page_count ?? 0),
    0,
  );
  if (indexed !== pages) {
    throw new Error(
      `site:links found ${pages} documentation pages and ${indexed} indexed for search`,
    );
  }
  return pages;
}
