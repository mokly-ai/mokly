import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";
import { installBindings } from "./helpers/sidecar.js";

test("Vite keeps the attributed authoring API ahead of a setup alias", async (context) => {
  const fixture = await reviewFixture(context);
  await fixture.write("stub.ts", 'export const definePage = () => "stub";');
  await fixture.write(
    "vite.config.ts",
    `import { resolve } from "node:path";
     export default { resolve: { alias: { "@mokly/mokly": resolve(import.meta.dirname, "stub.ts") } } };`,
  );
  await fixture.write("src/review.mockup.ts", reviewPage('"authored"'));
  const bundle = await fixture.compile();
  const definitions = await fixture.sidecar.call<Definitions>("describe", {
    generation: bundle.generation,
  });
  assert.equal(definitions.pages[0]?.sourcePath, "src/review.mockup.ts");
  assert.match((await fixture.render(bundle)).html, /<body>authored<\/body>/);
  await fixture.sidecar.call("shutdown");
});

test("Vite's virtual entry keeps configured files and preview ahead of absolute aliases", async (context) => {
  const fixture = await reviewFixture(context);
  const preview = ".storybook/preview.ts";
  const entry = "src/review.mockup.ts";
  const stories = "src/proof.stories.ts";
  fixture.params.storiesFiles.push(stories);
  fixture.params.renderer = "renderer.ts";
  await fixture.write(entry, reviewPage('"configured"'));
  await fixture.write(stories, 'export default { title: "Proof" };');
  await fixture.write(
    preview,
    'export default { globals: { mode: "preview" } };',
  );
  await fixture.write("renderer.ts", "export default ({ node }) => node;");
  await fixture.write("redirect.ts", reviewPage('"redirected"'));
  const alias = [entry, stories, preview, "renderer.ts"].map((file) => ({
    find: path.join(fixture.root, file),
    replacement: path.join(fixture.root, "redirect.ts"),
  }));
  await fixture.write(
    "vite.config.ts",
    `export default { resolve: { alias: ${JSON.stringify(alias)} } };`,
  );
  const bundle = await fixture.compile();
  assert.deepEqual(
    bundle.modules
      .map(({ path }) => path)
      .filter((file) => !file.startsWith("node_modules/")),
    [preview, "renderer.ts", stories, entry],
  );
  assert.match((await fixture.render(bundle)).html, /<body>configured<\/body>/);
  await fixture.sidecar.call("shutdown");
});

test("Vite uses Mokly's authoring and React imports before an ordered setup resolver", async (context) => {
  const fixture = await reviewFixture(context);
  const react = createRequire(import.meta.url).resolve("react");
  await fixture.write(
    "stub.ts",
    'export const definePage = () => "stub"; export default { version: "stub" };',
  );
  await fixture.write(
    "vite.config.ts",
    `import { resolve } from "node:path";
     export default { resolve: { alias: { react: ${JSON.stringify(react)} } }, plugins: [{
       name: "redirect-protected", resolveId: { order: "pre", handler(id) {
         if (id === "@mokly/mokly" || id === "react") return resolve(import.meta.dirname, "stub.ts");
       } },
     }] };`,
  );
  await fixture.write(
    "src/review.mockup.ts",
    reviewPage(
      'typeof React.createElement + "|authored"',
      'import React from "react";',
    ),
  );
  assert.match(
    (await fixture.render(await fixture.compile())).html,
    /<body>function\|authored<\/body>/,
  );
  await fixture.sidecar.call("shutdown");
});

test("Vite collects styles when a setup alias selects a style library file", async (context) => {
  const fixture = await reviewFixture(context);
  const library = createRequire(import.meta.url).resolve("styled-components");
  await fixture.write(
    "vite.config.ts",
    `export default { resolve: { alias: { "styled-components": ${JSON.stringify(library)} } } };`,
  );
  await fixture.write(
    "src/review.mockup.tsx",
    `import styled from "styled-components";
     import { defineScreen } from "@mokly/mokly";
     const Button = styled.button\`color:purple;\`;
     export const screen = defineScreen({path: "style", title: "Style", description: "", relatedDocs: [],
       render: () => <Button>Aliased style</Button>,
     });`,
  );
  fixture.params.entryFiles = ["src/review.mockup.tsx"];
  const { generation } = await fixture.compile();
  await fixture.sidecar.call("cssModules", { generation, classMaps: {} });
  await installBindings(fixture.sidecar, generation);
  const result = await fixture.sidecar.call<RenderResult>("renderScreen", {
    generation,
    handle: "src/review.mockup.tsx#screen",
    entry: { path: "style", title: "Style" },
    props: {},
    viewport: "mobile",
    colorScheme: "light",
  });
  assert.match(result.html, /<button[^>]*>Aliased style<\/button>/);
  assert.match(result.styles.map(({ css }) => css).join("\n"), /color:purple/);
  await fixture.sidecar.call("shutdown");
});
