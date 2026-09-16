/**
 * The copy rules in docs/protocol/site.md, read from the built pages rather
 * than the sources, so a phrase reaching a reader through a component, a
 * layout or generated content is caught too. Code samples are exempt, and so
 * is the Reference section, which republishes protocol documents verbatim.
 * The internal-noun rule is reviewed by hand: the nouns are exact vocabulary
 * on most pages and the changelog quotes release notes it does not author.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { sitePath } from "../src/workspace.js";

const dist = sitePath("dist");

/** Phrases the site never uses, whatever the page is about. */
const NEVER = ["not supported", "coming soon", "roadmap"];

/** The Reference section republishes protocol documents word for word. */
const REFERENCE = "/docs/reference/";

/** Every built page, addressed by the route that serves it. */
async function pages(): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".html"))
        found.set(
          `/${path.relative(dist, full).replace(/index\.html$/, "")}`,
          await readFile(full, "utf8"),
        );
    }
  };
  await walk(dist);
  return found;
}

/** A page's reader-visible text, without code samples or embedded assets. */
function prose(html: string): string {
  return html
    .replace(/<(script|style|pre|code)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:[a-z]+|#\d+);/gi, " ")
    .replace(/\s+/g, " ");
}

test("no page tells a reader what Mokly does not do", async () => {
  const built = await pages();
  assert.ok(built.size > 20, "the site was not built before this test");
  for (const [route, html] of built) {
    if (route.startsWith(REFERENCE)) continue;
    const text = prose(html);
    for (const phrase of NEVER) {
      assert.doesNotMatch(text, new RegExp(phrase, "i"), `${route}: ${phrase}`);
    }
  }
});
