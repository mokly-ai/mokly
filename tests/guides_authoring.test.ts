import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { generatedOutputMode } from "../dist/config/generated_output.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { GUIDES } from "./helpers/guides.js";

const pages = GUIDES.filter((page) => page.frontmatter.section === "authoring");
const sources = new Map(pages.map((page) => [page.id, page.source]));
const index = readFileSync(
  path.join(repositoryRoot, "src", "index.ts"),
  "utf8",
);
const configTypes = readFileSync(
  path.join(repositoryRoot, "src", "config", "types.ts"),
  "utf8",
);

function publicExports(): readonly string[] {
  return [...index.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/gu)]
    .flatMap(([, names]) => (names ?? "").split(","))
    .map(
      (name) =>
        name
          .trim()
          .split(/\s+as\s+/u)
          .pop()
          ?.trim() ?? "",
    )
    .filter((name) => name.length > 0);
}

function configFields(): readonly string[] {
  const block = /export interface MoklyConfig \{([\s\S]*?)\n\}/u.exec(
    configTypes,
  );
  return [...(block?.[1] ?? "").matchAll(/^ {2}(\w+)\??:/gmu)].map(
    ([, field]) => field ?? "",
  );
}

function names(text: string, source: string): boolean {
  return new RegExp(`\\b${text}\\b`, "u").test(source);
}

test("every public export is named on an authoring guide", () => {
  const exported = publicExports();
  assert.ok(exported.length > 40);
  for (const name of exported)
    assert.ok(
      [...sources.values()].some((source) => names(name, source)),
      `${name} is exported but documented nowhere`,
    );
});

test("the Config guide and MoklyConfig fields agree", () => {
  const source = sources.get("authoring/config") ?? "";
  const fields = configFields();
  assert.ok(fields.length > 5);
  for (const field of fields)
    assert.ok(names(field, source), `${field} is not on the Config guide`);
  assert.ok(names("defineConfig", source));
  const section = /\n## Fields\n([\s\S]*?)\n## /u.exec(source)?.[1] ?? "";
  const documented = [...section.matchAll(/^\| `(\w+)`\s+\|/gmu)].map(
    ([, field]) => field ?? "",
  );
  assert.ok(documented.length > 5);
  for (const field of documented)
    assert.ok(fields.includes(field), `${field} is not a configuration field`);
});

test("the generated-output guides agree with the runtime default", () => {
  assert.equal(generatedOutputMode(undefined), "derived");
  assert.match(
    sources.get("authoring/config") ?? "",
    /\| `generatedOutput`\s+\| `"derived"` \(default\).*`"committed"`/u,
  );
  assert.match(
    GUIDES.find((guide) => guide.id === "start/build")?.source ?? "",
    /By default generated files stay out of Git/u,
  );
  assert.match(
    GUIDES.find((guide) => guide.id === "cli/build")?.source ?? "",
    /With the default `generatedOutput: "derived"`/u,
  );
});

test("every named authoring concept retains its guide", () => {
  assert.deepEqual(
    pages.map((page) => page.slug),
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
      "styles",
    ],
  );
});
