import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { lightningTransform } from "../dist/build/styles/lightning.js";
import { ModuleBrowserTargets } from "../dist/build/styles/module_targets.js";
import { loadConfig } from "../dist/config/load.js";
import { extractCssReferences } from "../dist/html_references.js";
import { classifyResourceUrl } from "../dist/resource_url.js";

import { removeFixture } from "./helpers/fixture.js";
import { entryStyle, styleFixture } from "./helpers/imported_styles_fixture.js";

interface Scenario {
  readonly name: string;
  readonly css: string;
  readonly assets?: readonly string[];
  readonly imports?: boolean;
}

const scenarios: readonly Scenario[] = [
  {
    name: "url background",
    css: '.x{background:url("./background.png")}',
    assets: ["background.png"],
  },
  {
    name: "image-set scales and suffix",
    css: '.x{background:image-set(url("./one.png?v=2#part") 1x, url("./two.png") 2x)}',
    assets: ["one.png", "two.png"],
  },
  {
    name: "image-set type options",
    css: '.x{background-image:image-set(url("./typed.avif") 1x type("image/avif"), url("./typed.png") 2x type("image/png"))}',
    assets: ["typed.avif", "typed.png"],
  },
  {
    name: "gradient and image-set URL",
    css: '.x{background:image-set(linear-gradient(red, blue) 1x, url("./gradient.png") 2x)}',
    assets: ["gradient.png"],
  },
  {
    name: "prefixed image-set",
    css: '.x{background:-webkit-image-set(url("./prefixed.png") 1x)}',
    assets: ["prefixed.png"],
  },
  {
    name: "font face",
    css: '@font-face{font-family:Test;src:url("./font.woff2?v=1#glyph")}',
    assets: ["font.woff2"],
  },
  {
    name: "cursor",
    css: '.x{cursor:url("./cursor.png"),auto}',
    assets: ["cursor.png"],
  },
  {
    name: "mask image",
    css: '.x{mask-image:url("./mask.svg")}',
    assets: ["mask.svg"],
  },
  {
    name: "border image",
    css: '.x{border-image-source:image-set(url("./border.png") 1x)}',
    assets: ["border.png"],
  },
  {
    name: "list image",
    css: '.x{list-style-image:image-set(url("./list.png") 1x)}',
    assets: ["list.png"],
  },
  {
    name: "content",
    css: '.x{content:url("./content.png")}',
    assets: ["content.png"],
  },
  {
    name: "custom property URL and var",
    css: '.x{--icon:url("./icon.svg");mask-image:var(--icon);--set:image-set(url("./custom.png") 1x)}',
    assets: ["icon.svg", "custom.png"],
  },
  {
    name: "local remote and conditional imports",
    css: '@import "./base.css";@import url("https://fonts.example.test/theme.css") layer(fonts) screen;@import "./layered.css" layer(base) supports(display:grid) screen and (min-width: 1px);.x{color:red}',
    imports: true,
  },
  {
    name: "external quoted image-set strings",
    css: '.x{background:image-set("https://cdn.example.test/a.png" 1x, "data:image/png;base64,AA" 2x, "//cdn.example.test/b.png" 3x)}',
  },
];

interface CompiledStyle {
  readonly stylesheet: string;
  readonly assets: ReadonlyMap<string, Buffer>;
  readonly localReferences: readonly string[];
  readonly sourceFiles: readonly string[];
  readonly normalized: string;
}

async function buildScenario(
  context: { after(callback: () => Promise<void>): void },
  scenario: Scenario,
  module: boolean,
): Promise<CompiledStyle> {
  const fixture = await styleFixture(scenario.css, { module });
  context.after(() => removeFixture(fixture));
  for (const asset of scenario.assets ?? [])
    await fs.writeFile(
      path.join(fixture.entriesDir, asset),
      Buffer.from([0, 255, 23]),
    );
  if (scenario.imports) {
    await fs.writeFile(
      path.join(fixture.entriesDir, "base.css"),
      ".base{color:blue}",
    );
    await fs.writeFile(
      path.join(fixture.entriesDir, "layered.css"),
      ".layered{color:green}",
    );
  }
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  const stylesheet = compiled.outputs.get(entryStyle) as string;
  const assets = new Map(
    [...compiled.outputs]
      .filter(([route]) => route.startsWith("mokly-generated/assets/"))
      .map(
        ([route, bytes]) => [route, Buffer.from(bytes as Uint8Array)] as const,
      ),
  );
  const localReferences = [
    ...new Set(
      extractCssReferences(stylesheet)
        .filter(
          (reference) => classifyResourceUrl(reference, "css").kind === "local",
        )
        .map((reference) => {
          const suffixAt = reference.search(/[?#]/);
          const pathname =
            suffixAt < 0 ? reference : reference.slice(0, suffixAt);
          const suffix = suffixAt < 0 ? "" : reference.slice(suffixAt);
          return `${path.posix.normalize(path.posix.join(path.posix.dirname(entryStyle), decodeURIComponent(pathname)))}${suffix}`;
        }),
    ),
  ].sort();
  const normalized = lightningTransform()({
    filename: "comparison.css",
    code: Buffer.from(stylesheet.replace(/mokly_[A-Za-z0-9]+_/g, "")),
    minify: false,
    targets: new ModuleBrowserTargets(await loadConfig(fixture.root)).forFile(
      path.join(
        fixture.entriesDir,
        module ? "fixture.module.css" : "fixture.css",
      ),
    ),
  }).code.toString();
  return {
    stylesheet,
    normalized: normalized
      .split("\n")
      .filter((line, index, lines) => line !== lines[index - 1])
      .join("\n"),
    assets,
    localReferences,
    sourceFiles: compiled.manifest.sourceFiles
      .map((source) =>
        source.replace("entries/fixture.module.css", "entries/fixture.css"),
      )
      .sort(),
  };
}

for (const scenario of scenarios)
  test(`plain and module CSS deliver equivalent ${scenario.name}`, async (context) => {
    const plain = await buildScenario(context, scenario, false);
    const module = await buildScenario(context, scenario, true);
    assert.deepEqual(module.assets, plain.assets);
    assert.deepEqual(module.localReferences, plain.localReferences);
    assert.deepEqual(module.sourceFiles, plain.sourceFiles);
    assert.equal(module.normalized, plain.normalized);
    if (scenario.imports) {
      for (const marker of [
        ".base",
        ".layered",
        "https://fonts.example.test/theme.css",
      ])
        for (const output of [plain.stylesheet, module.stylesheet])
          assert.ok(output.includes(marker), `${marker}: ${output}`);
    }
    for (const asset of scenario.assets ?? [])
      assert.ok(
        module.assets.has(`mokly-generated/assets/entries/${asset}`),
        asset,
      );
  });
