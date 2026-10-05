import assert from "node:assert/strict";
import test from "node:test";

import { referencedDefinition } from "../dist/authoring/identity.js";
import { parseAuthoredLink } from "../dist/build/authored_links.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { defineScreen, mockLink } from "../dist/index.js";
import { EsbuildInteractiveBundleCompiler } from "../dist/interactive/bundle.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("definition references preserve the authored link token contract", () => {
  const definition = defineScreen({
    dependencies: [],
    description: "Reference before registry preparation",
    desktop: "Details",
    mobile: "Details",
    relatedDocs: [],
    title: "Details",
  });
  const link = mockLink(definition);
  const parsed = parseAuthoredLink(link);
  assert.ok(parsed);
  assert.equal(referencedDefinition(parsed.path, definition), definition);
  assert.equal(mockLink(definition), link);
});

test("Live bundles accept named path-based exports and definition links", async (t) => {
  const fixture = await createFixture(
    `
import { defineScreen, MockLink, mockLink } from "@mokly/mokly";
const common = { dependencies: [], relatedDocs: [], description: "Path fixture" };
export const target = defineScreen({
  ...common, path: "Account/Details", title: "Details", mobile: "Details", desktop: "Details"
});
const link = mockLink(target);
export const home = defineScreen({
  ...common, path: "Account/Home", title: "Home",
  mobile: <main><a href={link}>Definition</a><MockLink to="./Details">Relative</MockLink></main>,
  desktop: <main><MockLink to={target}>Definition</MockLink></main>,
  variants: [{ slug: "Empty", title: "Empty", description: "Empty", mobile: "Empty", desktop: "Empty" }]
});
`,
    { extraConfig: 'interactive: "serve",' },
  );
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  assert.deepEqual(Object.keys(runtime.interactiveEntries).sort(), [
    "Account/Details",
    "Account/Home",
    "Account/Home/Empty",
  ]);
  assert.ok(runtime.interactiveSources);
  const code = await new EsbuildInteractiveBundleCompiler().compile({
    config: runtime.config,
    sources: runtime.interactiveSources,
    signal: new AbortController().signal,
  });
  assert.match(code, /Account\/Details/);
  assert.match(code, /Account\/Home/);
});
