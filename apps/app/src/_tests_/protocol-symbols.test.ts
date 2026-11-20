import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { test } from "node:test";

import { repositoryRoot } from "./root";

/**
 * The protocol documents that describe this application by naming its own
 * symbols. They live here rather than under `docs/mockups` because what they
 * name is `apps/app/src`, and a check belongs beside the thing it can be wrong
 * about — the same reason `stylesheets.test.ts` reads the catalogue's CSS from
 * this suite rather than the other way round.
 */
const documents = [
  "docs/protocol/cloud/auth-callbacks.md",
  "docs/protocol/cloud/web-app.md",
  "docs/protocol/cloud/web-product-shell.md",
  "docs/protocol/cloud/viewer.md",
];

/**
 * Names a document may write that this application deliberately does not
 * define: the browser's own, which a reader looks up elsewhere. Everything
 * else a document names in backticks has to exist here — including the API
 * operations, which this application declares in `src/data`.
 *
 * Every entry is a claim of its own, checked in both directions below: a name
 * excused here must still be one a document writes, and must not be one this
 * application has since declared. An excuse nothing rests on is an exemption
 * that outlives its reason.
 */
const elsewhere = new Set(["back()"]);

function sources(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sources(path));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) found.push(path);
  }
  return found;
}

/**
 * What a document is entitled to name: a declaration the application makes at
 * the top level of a module, or a member of one of its interfaces that holds a
 * function. A local inside a function body is not one of these — it is a name
 * only its own few lines can see, and a check that counted it would be
 * satisfied by any file that happened to reuse the word.
 */
const declaration =
  /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function|const|let|class|type|interface)\s+([A-Za-z_$][\w$]*)/;

/** Where a named shape begins, and a member of one that holds a function. */
const shape = /^(?:export\s+)?(?:declare\s+)?(?:interface|type)\s+[A-Za-z_$]/;
const member = /^\s+(?:readonly\s+)?([A-Za-z_$][\w$]*)\??: \(/;

/**
 * Every name the application declares where another module could reach it.
 *
 * Members are read only inside a named shape, tracked by brace depth, because
 * an object literal's property is a value some function made rather than
 * something a document can name.
 */
function declared(): ReadonlySet<string> {
  const names = new Set<string>();
  const root = resolve(repositoryRoot, "apps/app/src");
  for (const path of sources(root)) {
    let depth = 0;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const top = depth === 0 ? declaration.exec(line) : undefined;
      if (top) names.add(top[1]);
      const inside = depth > 0 ? member.exec(line) : undefined;
      if (inside) names.add(inside[1]);
      if (depth > 0 || (top && shape.test(line))) {
        depth += (line.match(/{/g) ?? []).length;
        depth -= (line.match(/}/g) ?? []).length;
        if (depth < 0) depth = 0;
      }
    }
  }
  return names;
}

/** Every `symbol()` a document writes in backticks, with the document. */
function named(): Map<string, string> {
  const claims = new Map<string, string>();
  for (const document of documents) {
    const text = readFileSync(resolve(repositoryRoot, document), "utf8");
    for (const match of text.matchAll(/`([A-Za-z_$][\w$]*)\(\)`/g)) {
      claims.set(match[1] + "()", document);
    }
  }
  return claims;
}

/**
 * A protocol document that names a function is making a claim about the
 * application, and a claim nothing checks is one that survives the function
 * being renamed or deleted. Twice in a row a paragraph here described a
 * mechanism the code no longer had; this is what makes the third time a failed
 * build instead of a reader's wasted afternoon.
 */
test("every application symbol a protocol document names exists", () => {
  const defined = declared();
  const missing = [...named()]
    .filter(([symbol]) => !elsewhere.has(symbol))
    .filter(([symbol]) => !defined.has(symbol.slice(0, -2)))
    .map(([symbol, document]) => `${document} names ${symbol}`);
  assert.deepEqual(missing, []);
});

/**
 * The other half: a name excused as somebody else's must not quietly become
 * this application's, or the excuse stops being true and the check stops
 * covering it. An excuse no document rests on goes the same way, because an
 * exemption nobody needs is one that will one day cover something.
 */
test("every symbol excused as another package's is named and not owned", () => {
  const defined = declared();
  const claims = named();
  const wrong = [...elsewhere]
    .map((symbol) => {
      if (defined.has(symbol.slice(0, -2))) {
        return `${symbol} is declared in apps/app/src`;
      }
      return claims.has(symbol)
        ? undefined
        : `${symbol} is named by no document`;
    })
    .filter((problem) => problem !== undefined);
  assert.deepEqual(wrong, []);
});
