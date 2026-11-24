import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { GET as siteFavicon } from "../../../../apps/site/src/pages/favicon.svg";
import { attribute, documentElements } from "../../../../tests/helpers/html";

import { repositoryRoot } from "./root";

const publicDirectory = resolve(repositoryRoot, "packages/app/public");

/**
 * The `href` of every active `<link rel="icon">` in the application's
 * document, read through an HTML parser so that a commented-out link or
 * link-shaped text does not count.
 */
function iconLinks(document: string): string[] {
  return documentElements(
    document,
    (element) =>
      element.tagName === "link" && attribute(element, "rel") === "icon",
  ).map((element) => attribute(element, "href") ?? "");
}

/**
 * The app's icon is the site's generated favicon, byte for byte: the Mokly
 * mark in the light and dark token colours, switched by the browser's colour
 * scheme. Production serves the site's icon at `/favicon.svg`, and a preview
 * host serves the app's copy at the same path, so any drift in the drawing,
 * the colours, or the dark rule would show a different icon on previews.
 */
test("the document links the site's favicon from the public directory", async () => {
  const document = readFileSync(resolve(publicDirectory, "index.html"), "utf8");
  const links = iconLinks(document);
  assert.equal(links.length, 1, "the document links exactly one icon");
  const href = links[0] as string;
  assert.ok(href.startsWith("/"), `${href} must be root-relative`);
  const path = resolve(publicDirectory, href.slice(1));
  assert.ok(existsSync(path), `the public directory has no ${href}`);
  const expected = await siteFavicon().text();
  assert.equal(readFileSync(path, "utf8"), `${expected}\n`);
});
