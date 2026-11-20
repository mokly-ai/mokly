import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { DefaultTreeAdapterMap } from "parse5";
import { parse } from "parse5";

import { isExecutable, walkTree } from "../scripts/script-elements.js";
import { settings } from "../src/settings.js";

interface ScriptElement {
  attrs: DefaultTreeAdapterMap["element"]["attrs"];
  source: string | undefined;
}

function scriptElements(source: string): ScriptElement[] {
  const scripts: ScriptElement[] = [];
  walkTree(parse(source), (node) => {
    if ("tagName" in node && node.tagName === "script") {
      const sourceAttribute = node.attrs.find(({ name }) => name === "src");
      scripts.push({
        attrs: node.attrs,
        source: sourceAttribute?.value,
      });
    }
  });
  return scripts;
}

function assertScriptOrigins(source: string, page: URL, file: string): void {
  const expectedOrigin = new URL(settings.origin).origin;
  for (const script of scriptElements(source)) {
    assert.ok(
      script.source !== undefined || !isExecutable(script.attrs),
      `${file}: executable scripts must use an external source`,
    );
    if (script.source === undefined) continue;
    assert.equal(
      new URL(script.source, page).origin,
      expectedOrigin,
      `${file}: script ${script.source} must use the site origin`,
    );
  }
}

async function htmlFiles(root: string, directory = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(root, relative)));
    else if (entry.isFile() && entry.name.endsWith(".html"))
      files.push(relative);
  }
  return files;
}

test("every built page loads scripts from the site origin", async () => {
  const root = path.resolve(import.meta.dirname, "../dist");
  for (const file of await htmlFiles(root)) {
    const page = new URL(
      file.replace(/index\.html$/, ""),
      settings.origin + "/",
    );
    const source = await readFile(path.join(root, file), "utf8");
    assertScriptOrigins(source, page, file);
  }
});

test("an external built script is rejected", () => {
  const source = '<script src="https://scripts.example/app.js"></script>';
  assert.throws(
    () => assertScriptOrigins(source, new URL(settings.origin), "index.html"),
    /script https:\/\/scripts\.example\/app\.js must use the site origin/,
  );
});

test("an executable inline script is rejected", () => {
  assert.throws(
    () =>
      assertScriptOrigins(
        "<script>globalThis.inline = true;</script>",
        new URL(settings.origin),
        "index.html",
      ),
    /index\.html: executable scripts must use an external source/,
  );
});

test("an inline data block is accepted", () => {
  assert.doesNotThrow(() =>
    assertScriptOrigins(
      '<script type="application/ld+json">{}</script>',
      new URL(settings.origin),
      "index.html",
    ),
  );
});
