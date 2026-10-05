import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

async function read(file: string): Promise<string> {
  return (await fs.readFile(path.join(repositoryRoot, file), "utf8")).replace(
    /\s+/gu,
    " ",
  );
}

const protocol = (name: string) => read(`docs/protocol/${name}.md`);

test("watch contract retains imported CSS and PostCSS invalidation rules", async () => {
  const text = await protocol("mokly-watch");
  for (const rule of [
    /(?:CSS Modules|modules), nested imports, local assets and PostCSS-reported files/u,
    /directory dependencies watch matching file additions, not deletions/u,
    /newly added non-ignored subdirectory/u,
    /absent glob means `\*\*\/\*`/u,
    /PostCSS module and its imports reload configuration before rebuilding/u,
    /accepted generation and browser reload event advance together/u,
    /generated routes and their symlink aliases never schedule a feedback loop/u,
  ])
    assert.match(text, rule);
});

test("watch contract retains invalid public aliases and output precedence", async () => {
  const text = await protocol("mokly-watch");
  for (const rule of [
    /previously reachable public resource remains a reload input/u,
    /symlink temporarily points outside the repository or dangles/u,
    /never watch the escaped physical target/u,
    /Generated output, Review output and the cache take precedence over exact required inputs/u,
    /denied directory \*\*names\*\* apply only to discovery and directory scans/u,
  ])
    assert.match(text, rule);
});

test("watch contract retains generation indexes and effective-root replacement", async () => {
  const text = await protocol("mokly-watch");
  for (const rule of [
    /generation-scoped index of exact required files and their ancestors/u,
    /once per accepted config\/inventory/u,
    /denied-name directory lies between that root and a required file/u,
    /arrival changes the effective watch-target set and replaces the watcher/u,
    /only when the set of effective watch roots changes/u,
    /without extra graph loads for watcher replacement/u,
  ])
    assert.match(text, rule);
});

test("quick start retains the file-derived path example", async () => {
  const text = await read("README.md");
  assert.match(text, /derives everything else from the file/u);
  assert.match(text, /`account\/account-home\/index\.mobile\.html`/u);
  assert.match(text, /one file per viewport and color scheme/u);
  assert.match(
    text,
    /baseline compatibility.*mokly-baseline-compatibility\.md/u,
  );
});

test("export contract keeps removed variants and identity-based missing sides", async () => {
  const text = await protocol("mokly-export");
  assert.match(
    text,
    /Removed screens, pages, documents, components and variants retain their baseline context/u,
  );
  assert.match(text, /current and removed records never share a path/u);
  assert.match(
    text,
    /A path absent from one side follows the added\/removed rules unless the/u,
  );
  assert.doesNotMatch(
    text,
    /current ids and routes win when reused|A route absent from a side's manifest/u,
  );
});

test("catalogue contract retains source metadata privacy across its split", async () => {
  let text = await protocol("mokly-catalogue");
  if (text.includes("./mokly-catalogue-delivery.md"))
    text += await protocol("mokly-catalogue-delivery");
  assert.match(
    text,
    /`sourcePath`, optional invocation `source\.path`, and local related-doc paths stay repository-relative metadata/u,
  );
  assert.match(text, /They never become source-serving URLs/u);
});

test("component input contract retains variant slugs and derived paths", async () => {
  const text = await protocol("mokly-components");
  assert.match(text, /A variant's path is the parent's path plus its slug/u);
  assert.match(text, /its file names follow the/u);
  assert.doesNotMatch(
    text,
    /input includes.*?a stable relative `\.html` route/u,
  );
  assert.doesNotMatch(text, /kebab-case strings within their component/u);
  assert.match(
    text,
    /Repeating one real stylesheet links it once with a warning/u,
  );
});

test("Review README retains generated-byte and frozen-source boundaries", async () => {
  const text = await read("src/review/README.md");
  for (const rule of [
    /`imported_changes\.ts` compares accepted generated CSS and binary asset bytes/u,
    /even when Git ignores derived output/u,
    /Committed classification never reloads the graph or reruns PostCSS/u,
    /without an accepted generation performs one inventory load/u,
    /Source validation accepts dependency reasons only from that record/u,
    /never trusts result view records as sources/u,
  ])
    assert.match(text, rule);
});

test("CSS membership retains actual-invocation evidence without invented variants", async () => {
  const text = await protocol("mokly-css-attribution-membership");
  assert.match(text, /Variant view states and exclusions remain unchanged/u);
  assert.match(text, /no synthetic variant entry is created/u);
});

test("CSS contract retains evidence before comparison without repeated analysis", async () => {
  const text = await protocol("mokly-css-attribution");
  assert.match(text, /before a comparison is loaded/u);
  assert.match(text, /without a second resource analysis/u);
});

test("component design retains runtime and published-props boundaries", async () => {
  const text = await protocol("mokly-component-design");
  assert.match(text, /Published catalogues expose read-only saved props/u);
  assert.match(
    text,
    /Runtime registration, attribution, inspection, and local editable previews implement these designs/u,
  );
});

test("design component adoption retains its presentation and navigation authorities", async () => {
  const text = await protocol("mokly-design-components");
  assert.match(text, /library inventory.*define delivery/u);
  assert.match(text, /retain presentation\/navigation authority/u);
});

test("workspace design retains owning screens and shared shell alignment", async () => {
  const text = await protocol("mokly-component-workspace-design");
  assert.match(
    text,
    /Owning mobile\/desktop screens remain review entry points/u,
  );
  assert.match(text, /aligned with/u);
});

test("inspector design retains non-component and removed-consumer stages", async () => {
  const text = await protocol("mokly-component-inspector-design");
  assert.match(text, /non-component artboards retain the shell/u);
  assert.match(
    text,
    /Removed consumer stages retain this inspector around the previous version/u,
  );
});
