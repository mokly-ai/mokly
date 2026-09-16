import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { LinkDocument } from "./documents.js";
import { cssReferences, htmlDocument } from "./documents.js";

async function inventory(root: string, directory = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await inventory(root, relative)));
    else if (entry.isFile()) files.push(relative);
    else
      throw new Error(
        `site:links cannot inspect non-regular output: ${relative}`,
      );
  }
  return files.sort();
}

function documentUrl(file: string, origin: string): URL {
  return new URL(
    file.split("/").map(encodeURIComponent).join("/"),
    `${origin}/`,
  );
}

function resolveReference(
  reference: string,
  base: URL,
  origin: string,
  files: Set<string>,
  documents: Map<string, LinkDocument>,
): string | undefined {
  if (/^(?:data|mailto|tel|blob|about):/i.test(reference)) return;
  let url: URL;
  let target: string;
  let fragment: string;
  try {
    url = new URL(reference, base);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return "unsupported URL scheme";
    if (url.origin !== origin) return;
    target = decodeURIComponent(url.pathname).replace(/^\//, "");
    fragment = decodeURIComponent(url.hash.slice(1).split(":~:text=")[0] ?? "");
  } catch {
    return "malformed URL or percent encoding";
  }
  if (
    target.includes("\\") ||
    target.includes("\0") ||
    target.split("/").includes("..")
  ) {
    return "invalid output path";
  }
  const file = [target, path.posix.join(target, "index.html")].find(
    (candidate) => files.has(candidate),
  );
  if (!file) return `missing file ${url.pathname}`;
  const document = documents.get(file);
  if (
    fragment &&
    document &&
    !document.ids.has(fragment) &&
    fragment.toLowerCase() !== "top"
  ) {
    return `missing anchor #${fragment} in ${file}`;
  }
  return;
}

/** Inspect the complete static output without network requests or server fallbacks. */
export async function checkLinks(
  root: string,
  origin: string,
): Promise<number> {
  const files = new Set(await inventory(root));
  if (![...files].some((file) => file.endsWith(".html"))) {
    throw new Error("site:links found no HTML; run site:build first");
  }
  const documents = new Map<string, LinkDocument>();
  const errors: string[] = [];
  for (const file of files) {
    if (!/\.(?:html|svg|css)$/.test(file)) continue;
    const source = await readFile(path.join(root, file), "utf8");
    try {
      documents.set(
        file,
        file.endsWith(".css")
          ? {
              ids: new Set(),
              references: cssReferences(source).filter(
                (url) => !url.startsWith("#"),
              ),
              base: undefined,
            }
          : htmlDocument(source),
      );
    } catch (error) {
      errors.push(
        `${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  let checked = 0;
  for (const [file, document] of documents) {
    let base = documentUrl(file, origin);
    try {
      if (document.base !== undefined) base = new URL(document.base, base);
    } catch {
      errors.push(`${file}: malformed base href ${document.base}`);
      continue;
    }
    for (const reference of document.references) {
      const error = resolveReference(reference, base, origin, files, documents);
      if (error)
        errors.push(`${file}: ${JSON.stringify(reference)} — ${error}`);
      checked += 1;
    }
  }
  if (errors.length)
    throw new Error(`site:links failed:\n${errors.join("\n")}`);
  return checked;
}
