import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DOCS_PAGES } from "../src/docs/pages.js";
import { repositoryPath } from "../src/workspace.js";

/**
 * Authoring is verified against the package's own public surface: every name
 * a consumer can import is named on an authoring page, and every field of the
 * configuration is on the Config page.
 */

const pages = DOCS_PAGES.filter((page) => page.section === "authoring");
const sources = new Map(
  pages.map((page) => [page.id, readFileSync(page.source, "utf8")]),
);
const index = readFileSync(repositoryPath("src", "index.ts"), "utf8");
const configTypes = readFileSync(
  repositoryPath("src", "config", "types.ts"),
  "utf8",
);

function publicExports(): readonly string[] {
  return [...index.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)]
    .flatMap(([, names]) => (names ?? "").split(","))
    .map(
      (name) =>
        name
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim() ?? "",
    )
    .filter((name) => name.length > 0);
}

function configFields(): readonly string[] {
  const block = /export interface MoklyConfig \{([\s\S]*?)\n\}/.exec(
    configTypes,
  );
  return [...(block?.[1] ?? "").matchAll(/^ {2}(\w+)\??:/gm)].map(
    ([, field]) => field ?? "",
  );
}

function names(text: string, source: string): boolean {
  return new RegExp(`\\b${text}\\b`).test(source);
}

test("every public export is named on an authoring page", () => {
  const exported = publicExports();
  assert.ok(exported.length > 40, "the package exports its authoring surface");
  for (const name of exported) {
    const found = [...sources.values()].some((source) => names(name, source));
    assert.ok(found, `${name} is exported but documented nowhere`);
  }
});

test("the Config page names every field of the configuration", () => {
  const source = sources.get("authoring/config") ?? "";
  const fields = configFields();
  assert.ok(fields.length > 5, "the configuration has fields");
  for (const field of fields) {
    assert.ok(names(field, source), `${field} is not on the Config page`);
  }
  assert.ok(names("defineConfig", source));
});

test("no authoring page names a field the configuration does not have", () => {
  const page = sources.get("authoring/config") ?? "";
  const section = /\n## Fields\n([\s\S]*?)\n## /.exec(page)?.[1] ?? "";
  const documented = [...section.matchAll(/^\| `(\w+)`\s+\|/gm)].map(
    ([, field]) => field ?? "",
  );
  assert.ok(documented.length > 5, "the fields are documented in a table");
  for (const field of documented) {
    assert.ok(
      configFields().includes(field),
      `${field} is documented but is not a configuration field`,
    );
  }
});

test("each authoring concept has the page the architecture names", () => {
  assert.deepEqual(
    pages.map((page) => page.id.slice("authoring/".length)),
    [
      "config",
      "screens",
      "components",
      "viewports-and-color-schemes",
      "collections-and-tags",
      "use-case-flows",
      "pages",
      "links",
      "review-ignore",
    ],
  );
});
