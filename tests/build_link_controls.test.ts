import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import {
  registerFixturePage,
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

function source(body: string): string {
  return validEntrySource({ body }).replace(
    'import React from "react";',
    'import React from "react"; import { MockLink } from "@mokly/mokly";',
  );
}

test("child controls become styled native links in every generated view", async (context) => {
  const fixture = await createFixture(
    source(`<MockLink asChild to="details">
      <button className="primary" style={{ color: "red", display: "flex" }}
        aria-label="Continue preparing" type="submit" name="action" value="save">
        <span>Continue</span><svg><path d="M0 0" /></svg>
      </button>
    </MockLink>`),
    { extraConfig: 'colorSchemes: ["light", "dark"],' },
  );
  context.after(() => removeFixture(fixture));
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  for (const viewport of ["mobile", "desktop"]) {
    for (const scheme of ["", ".dark"]) {
      const html =
        textOutput(
          compilation.outputs,
          `screens/home.${viewport}${scheme}.html`,
        ) ?? "";
      assert.match(html, /<a class="primary"/);
      assert.match(html, /style="color:red;display:flex"/);
      assert.match(html, /aria-label="Continue preparing"/);
      assert.match(html, /<span>Continue<\/span><svg>/);
      assert.ok(html.includes(`href="./details.${viewport}${scheme}.html"`));
      assert.match(html, /data-mokly-link="details"/);
      assert.match(html, /:focus-visible/);
      assert.doesNotMatch(
        html,
        /<button|<template|asChild|name="action"|type="submit"/,
      );
    }
  }
});

test("default links and unmarked documents retain identical bytes", async (context) => {
  const fixture = await createFixture(
    source('<MockLink to="details">Details</MockLink>'),
  );
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const original = await compileCatalogue(config);
  await fs.promises.writeFile(
    fixture.entryPath,
    source('<MockLink asChild={false} to="details">Details</MockLink>'),
  );
  const explicit = await compileCatalogue(config);
  assert.deepEqual(explicit.outputs, original.outputs);
  assert.doesNotMatch(
    textOutput(original.outputs, "screens/home.mobile.html") ?? "",
    /link-control/,
  );
});

for (const body of [
  "<button disabled>Disabled</button>",
  '<button aria-disabled="true">Disabled</button>',
  '<button aria-busy="true">Busy</button>',
  '<a href="mock:details" aria-disabled="true">Disabled link</a>',
  '<div role="button" aria-busy="true" tabIndex={0}>Busy custom control</div>',
]) {
  test(`inactive child has only validated destination metadata: ${body}`, async (context) => {
    const fixture = await createFixture(
      source(`<MockLink asChild to="details">${body}</MockLink>`),
    );
    context.after(() => removeFixture(fixture));
    const compilation = await compileCatalogue(await loadConfig(fixture.root));
    const html =
      textOutput(compilation.outputs, "screens/home.mobile.html") ?? "";
    assert.match(html, /data-nav-href="\.\/details\.mobile\.html"/);
    assert.doesNotMatch(
      html,
      /data-mokly-link=|(?<![\w-])href=|link-control-styles/,
    );
    if (body.startsWith("<button")) assert.match(html, /type="button"/);
  });
}

for (const body of [
  '<MockLink asChild to="details">Text</MockLink>',
  '<MockLink asChild to="details"><><button>One</button></></MockLink>',
  '<MockLink asChild to="details"><button>One</button><button>Two</button></MockLink>',
  '<MockLink asChild to="details" className="lost"><button>One</button></MockLink>',
  '<MockLink asChild="true" to="details"><button>One</button></MockLink>',
  '<MockLink asChild to="details"><div><button>One</button></div></MockLink>',
  '<MockLink asChild to="details"><button><a href="mock:home">Nested</a></button></MockLink>',
  '<MockLink asChild to="details"><div role="checkbox">Wrong role</div></MockLink>',
  '<MockLink asChild to="details"><input value="Void" readOnly /></MockLink>',
  '<MockLink asChild to="details"><span tabIndex={0}><span tabIndex={-1}>Focus</span></span></MockLink>',
  '<MockLink asChild to="details"><a href="mock:home">Conflict</a></MockLink>',
  '<MockLink asChild to="details"><span data-nav-href="mock:home">Conflict</span></MockLink>',
  '<MockLink asChild to="details"><div><MockLink asChild to="home"><button>Nested</button></MockLink></div></MockLink>',
  '<a href="mock:home"><MockLink asChild to="details"><span>Nested</span></MockLink></a>',
  '<template><MockLink asChild to="details"><button>Inert</button></MockLink></template>',
]) {
  test(`invalid child adaptation fails explicitly: ${body}`, async (context) => {
    const fixture = await createFixture(source(body));
    context.after(() => removeFixture(fixture));
    await assert.rejects(
      async () => compileCatalogue(await loadConfig(fixture.root)),
      /MockLink|child.link|child control/i,
    );
  });
}

test("inactive destinations still reject unknown ids", async (context) => {
  const fixture = await createFixture(
    source(
      '<MockLink asChild to="missing"><button disabled>Missing</button></MockLink>',
    ),
  );
  context.after(() => removeFixture(fixture));
  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    /unknown id: missing/,
  );
});

test("child links retain use-case identity, fragments, and light fallback", async (context) => {
  const fixture = await createFixture(
    source(
      '<MockLink asChild to="tour" fragment="summary"><button>Restart tour</button></MockLink>',
    )
      .replace('id="home"', 'id="summary"')
      .replace('id="home-mobile"', 'id="summary"')
      .replace(
        'description: "Home screen"',
        'colorSchemes: ["light"], description: "Home screen"',
      )
      .replace(
        'desktop: <main id="details">Detail</main>',
        'desktop: <main><MockLink asChild to="tour" fragment="summary"><span>Tour</span></MockLink></main>',
      ),
    { extraConfig: 'colorSchemes: ["light", "dark"],' },
  );
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const dark =
    textOutput(compilation.outputs, "screens/details.desktop.dark.html") ?? "";
  assert.match(dark, /href="\.\/home\.desktop\.html#summary"/);
  assert.match(dark, /data-mokly-link="tour#summary"/);
  const content = await fs.promises.readFile(fixture.entryPath, "utf8");
  await fs.promises.writeFile(
    fixture.entryPath,
    content.replace('id="summary"', 'id="removed"'),
  );
  await assert.rejects(
    async () => compileCatalogue(config),
    /logical fragment summary.*missing/,
  );
});

test("custom and legacy renderers adapt controls before compatibility checks", async (context) => {
  const fixture = await createFixture(
    source(
      '<MockLink asChild to="details"><div role="button">Continue</div></MockLink>',
    ),
    {
      extraConfig:
        'renderer: "renderer.tsx",  compatibility: { transformer: "transform.ts" },',
    },
  );
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default input => '<!doctype html><html><body data-custom="yes">'+renderToStaticMarkup(input.node)+'</body></html>';`,
  );
  await fs.promises.mkdir(path.join(fixture.root, "legacy"));
  await fs.promises.writeFile(
    path.join(fixture.root, "legacy/old.source.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; import { MockLink } from "@mokly/mokly";
export const source = () => '<html><body>'+renderToStaticMarkup(<MockLink asChild to="details"><button>Legacy</button></MockLink>)+'</body></html>';`,
  );
  const transformer = path.join(fixture.root, "transform.ts");
  await fs.promises.writeFile(
    transformer,
    `export default input => {
if (input.content.includes("<template")) throw new Error("unconsumed child link");
return input.content; };`,
  );
  await registerFixturePage(
    fixture,
    "old",
    "old.html",
    "legacy/old.source.tsx",
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  for (const route of ["screens/home.mobile.html", "old.html"]) {
    assert.match(
      textOutput(compilation.outputs, route) ?? "",
      /data-mokly-link="details"/,
    );
  }
  await fs.promises.writeFile(
    transformer,
    `export default input => input.content.replace('data-mokly-link="details"', 'data-mokly-link="home"');`,
  );
  await assert.rejects(
    async () => compileCatalogue(config),
    /logical|marker|record/i,
  );
  await fs.promises.writeFile(
    transformer,
    `export default input => input.content.replace('</body>', '<template data-mokly-link-child-end=""></template></body>');`,
  );
  await assert.rejects(
    async () => compileCatalogue(config),
    /unconsumed markers/,
  );
});
