/**
 * Move every executable inline script that Astro emits, the island bootstraps
 * and the small processed scripts, into a deterministic content-hashed asset
 * under `/_astro/`, so the published pages satisfy a Content Security Policy
 * that forbids inline scripts. Runs after the Astro build and before the
 * search index reads the output.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "parse5";

import { isExecutable, walkTree } from "./script-elements.js";

interface InlineScript {
  body: string;
  end: number;
  start: number;
  startTagEnd: number;
}

const outputRoot = path.resolve(import.meta.dirname, "../dist");

function inlineScripts(source: string): InlineScript[] {
  const scripts: InlineScript[] = [];
  walkTree(parse(source, { sourceCodeLocationInfo: true }), (node) => {
    if (
      "tagName" in node &&
      node.tagName === "script" &&
      !node.attrs.some(({ name }) => name === "src") &&
      isExecutable(node.attrs)
    ) {
      const location = node.sourceCodeLocation;
      if (!location?.startTag || !location.endTag) {
        throw new Error("Executable inline script has no complete source span");
      }
      scripts.push({
        body: source.slice(
          location.startTag.endOffset,
          location.endTag.startOffset,
        ),
        end: location.endOffset,
        start: location.startOffset,
        startTagEnd: location.startTag.endOffset,
      });
    }
  });
  return scripts;
}

function externalTag(
  source: string,
  script: InlineScript,
  assetPath: string,
): string {
  const startTag = source.slice(script.start, script.startTagEnd);
  if (!startTag.endsWith(">")) {
    throw new Error("Executable inline script has an invalid start tag");
  }
  return `${startTag.slice(0, -1)} src="${assetPath}"></script>`;
}

async function htmlFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".html"))
      files.push(entryPath);
  }
  return files;
}

/** Externalize executable inline scripts from one HTML document. */
export function externalizeDocument(source: string): {
  assets: ReadonlyMap<string, string>;
  output: string;
} {
  const assets = new Map<string, string>();
  const scripts = inlineScripts(source).sort(
    (left, right) => right.start - left.start,
  );
  let output = source;
  for (const script of scripts) {
    const digest = createHash("sha256").update(script.body).digest("hex");
    const assetName = `inline.${digest}.js`;
    assets.set(assetName, script.body);
    const replacement = externalTag(source, script, `/_astro/${assetName}`);
    output = `${output.slice(0, script.start)}${replacement}${output.slice(script.end)}`;
  }
  return { assets, output };
}

async function externalizeSite(): Promise<void> {
  const assets = new Map<string, string>();
  for (const file of await htmlFiles(outputRoot)) {
    const source = await readFile(file, "utf8");
    const externalized = externalizeDocument(source);
    for (const [name, body] of externalized.assets) assets.set(name, body);
    if (externalized.assets.size > 0) {
      await writeFile(file, externalized.output);
    }
  }

  const assetRoot = path.join(outputRoot, "_astro");
  await mkdir(assetRoot, { recursive: true });
  for (const [name, body] of assets) {
    await writeFile(path.join(assetRoot, name), body);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await externalizeSite();
}
