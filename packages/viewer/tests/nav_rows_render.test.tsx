import assert from "node:assert/strict";
import { test } from "node:test";

import { viewHref } from "../src/navigation/routes.js";

import { standaloneMarkup } from "./shell_markup.js";

/** The standalone shell at one entry's route, or at the catalogue home. */
function render(screenPath: string | null): string {
  return standaloneMarkup({
    path: screenPath === null ? "/" : viewHref(screenPath),
  });
}

function element(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  assert.ok(match, String(pattern));
  return match[0];
}

/** The Path row of Inspect's head, up to the end of its path. */
const PATH_ROW =
  /<div class="mbk-meta-row mbk-reset" data-inspect-path=""[\s\S]*?<\/code>/;

test("a folder's own document is its first row, labelled Overview with the document icon", () => {
  const html = render("product");
  const folder = element(
    html,
    /<details class="mbk-nav-group mbk-reset" data-nav-folder="folder:product"[\s\S]*?<\/summary>[\s\S]*?<\/a>/,
  );
  const row = element(folder, /<a [^>]*data-entry-id="product"[\s\S]*?<\/a>/);
  assert.match(row, /aria-current="page"/);
  assert.match(row, /data-entry-kind="document"/);
  assert.match(row, /data-nav-index=""/);
  assert.match(
    row,
    /<path d="M9 13h6M9 17h4"><\/path><\/svg><\/span>Overview</,
  );
  assert.match(
    folder,
    /<span class="mbk-nav-label mbk-reset">Product overview<\/span>/,
  );
});

test("the Specs section holds every kind but components, which keep their own section", () => {
  const html = render(null);
  assert.match(
    html,
    /data-nav-disclosure="section:specs" data-nav-section="specs"/,
  );
  assert.match(
    html,
    /data-nav-disclosure="section:components" data-nav-section="components"/,
  );
  assert.doesNotMatch(html, /section:pages|data-nav-section="pages"/);
  const specs = element(
    html,
    /data-nav-section="specs"[\s\S]*?(?=data-nav-section="components")/,
  );
  assert.doesNotMatch(specs, /data-entry-kind="component"/);
  for (const kind of ["document", "page", "screen", "use-case"])
    assert.match(specs, new RegExp(`data-entry-kind="${kind}"`), kind);
});

test("the Path row's folder segments link a folder's page and reveal a folder without one", () => {
  const path = element(render("product/browse/home"), PATH_ROW);
  assert.match(
    path,
    /<a class="mbk-path-crumb mbk-reset" href="\/view\/product\/">product<\/a>/,
  );
  assert.match(
    path,
    /<button class="mbk-path-crumb mbk-reset" data-crumb-folder="product\/browse" type="button">browse<\/button>/,
  );
  assert.match(path, /<span class="mbk-path-part mbk-reset">home<\/span>/);
});

test("component details show the shown entry's path above its source", () => {
  const html = render("components/action/default");
  const path = element(html, PATH_ROW);
  assert.equal(path.replace(/<[^>]+>/g, ""), "Pathcomponents/action/default");
  assert.match(
    html.slice(html.indexOf(path) + path.length),
    /^<\/span><\/div><div class="mbk-meta-row mbk-reset"><span class="mbk-meta-k mbk-reset">Source<\/span>/,
  );
});
