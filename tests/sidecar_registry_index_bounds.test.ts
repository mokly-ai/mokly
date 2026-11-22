import assert from "node:assert/strict";
import test from "node:test";

import type { CompiledGeneration } from "../packages/mokly/src/generated/sidecar/CompiledGeneration.js";
import { restore } from "../packages/mokly/src/sidecar/compiled.js";
import { HtmlInput } from "../packages/mokly/src/sidecar/html_input.js";
import {
  REGISTRY_OUTPUT_LIMIT,
  REGISTRY_TEXT_LIMIT,
  RegistryIndex,
} from "../packages/mokly/src/sidecar/registry-index.js";

import { bundleParams } from "./helpers/sidecar.js";

const fragment = (classes: string) =>
  new HtmlInput(`<i class="${classes}"></i>`);

test("the registry index holds at most its text limit and drops the least recently used text first", () => {
  const index = new RegistryIndex();
  const texts = Array.from(
    { length: REGISTRY_TEXT_LIMIT + 2 },
    (_, item) => `.t${item}{order:${item}}`,
  );
  for (const [item, css] of texts.entries()) {
    assert.equal(index.styles(css, fragment(`t${item}`)), css);
    assert.ok(index.texts.size <= REGISTRY_TEXT_LIMIT, `after text ${item}`);
  }
  assert.deepEqual(
    [...index.texts.keys()],
    texts.slice(texts.length - REGISTRY_TEXT_LIMIT),
  );
  assert.equal(index.styles(texts[0]!, fragment("t0")), texts[0]);
  assert.deepEqual(
    [...index.texts.keys()],
    [...texts.slice(texts.length - REGISTRY_TEXT_LIMIT + 1), texts[0]],
  );
});

test("an indexed text holds at most its output limit and drops the least recently used output first", () => {
  const index = new RegistryIndex();
  const rules = Array.from(
    { length: REGISTRY_OUTPUT_LIMIT + 2 },
    (_, item) => `.c${item}{order:${item}}`,
  );
  const css = rules.join("\n");
  const filter = (item: number) => index.styles(css, fragment(`c${item}`));
  const held = () => [...(index.texts.get(css)?.outputs.values() ?? [])];
  for (const [item, rule] of rules.entries()) {
    assert.equal(filter(item), rule);
    assert.ok(held().length <= REGISTRY_OUTPUT_LIMIT, `after output ${item}`);
  }
  assert.deepEqual(held(), rules.slice(2));
  assert.equal(filter(2), rules[2]);
  assert.equal(filter(0), rules[0]);
  assert.deepEqual(held(), [...rules.slice(4), rules[2], rules[0]]);
});

test("each restored generation owns its own registry index", () => {
  const compiled: CompiledGeneration = {
    toolchain: "toolchain",
    reuseEvidence: { complete: false, durable: false, inputs: {} },
    identity: "identity",
    code: "",
    runtimeKey: "runtime",
    dependencyRoots: [],
    cssModules: [],
    sources: {},
    peers: {},
    inputs: {},
    metadataInputs: {},
    inputDirectories: {},
    metadataDirectories: {},
  };
  const first = restore(bundleParams(), compiled, []);
  const second = restore(bundleParams(), compiled, []);
  const css = ".a{color:red}.b{color:blue}";
  assert.equal(first.registryIndex.styles(css, fragment("a")), ".a{color:red}");
  assert.deepEqual([...first.registryIndex.texts.keys()], [css]);
  assert.equal(second.registryIndex.texts.size, 0);
});
