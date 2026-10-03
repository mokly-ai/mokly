import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import type { ComponentRuntime } from "../../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../../dist/build/live_runtime.js";
import { loadConfig } from "../../dist/config/load.js";
import { EsbuildInteractiveBundleCompiler } from "../../dist/interactive/bundle.js";

import { createFixture, validEntrySource } from "./fixture.js";

/** A real consumer graph with plain CSS, module bindings and local PostCSS. */
export async function interactiveStylesFixture(
  mode: "derived" | "committed" = "derived",
) {
  const source = `import styles, { card } from "./card.module.css";
import "./plain.css";
${validEntrySource({ body: "<main className={styles.card} data-module={card}>Styled preview</main>" })}`;
  const fixture = await createFixture(source, {
    extraConfig: `interactive: "serve", generatedOutput: "${mode}", postcss: "postcss.config.mjs",`,
  });
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "fixture-color", Declaration(declaration) { if (declaration.value === "fixture-color") declaration.value = "rebeccapurple"; } }] };`,
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "card.module.css"),
    ".card { color: fixture-color; }\n",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "plain.css"),
    'main { background-image: url("./signal.png"); }\n',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "signal.png"),
    Buffer.from([0, 255, 128, 42]),
  );
  return fixture;
}

/** Accept one generation through the Node graph and registry boundary. */
export async function acceptedStyles(root: string): Promise<ComponentRuntime> {
  return prepareLiveRuntime(await loadConfig(root));
}

/** Compile from the accepted capture without inspecting current repository CSS. */
export async function compileLiveStyles(
  runtime: ComponentRuntime,
): Promise<string> {
  assert.ok(runtime.interactiveSources);
  return new EsbuildInteractiveBundleCompiler().compile({
    config: runtime.config,
    signal: new AbortController().signal,
    sources: runtime.interactiveSources,
  });
}
