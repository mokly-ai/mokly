import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

const source = validEntrySource({
  body: '<MockLink asChild to="details"><button id="continue">Continue</button></MockLink><MockLink to="details" id="ordinary">Plain</MockLink>',
}).replace(
  'import React from "react";',
  'import React from "react"; import { MockLink } from "@mokly/mokly";',
);

test("custom renderer casing cannot bypass child adaptation", async (context) => {
  const fixture = await createFixture(source, {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default input => '<html><body>' + renderToStaticMarkup(input.node).replaceAll('data-mokly-link-child-', 'DATA-MOKLY-LINK-CHILD-') + '</body></html>';`,
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const html =
    textOutput(compilation.outputs, "screens/home.mobile.html") ?? "";
  assert.match(html, /<a id="continue"/);
  assert.match(html, /data-mokly-link-control="button"/);
  assert.doesNotMatch(html, /data-mokly-link-child-/i);
});

test("compatibility transforms cannot introduce or alter owned control metadata", async (context) => {
  const fixture = await createFixture(source, {
    extraConfig: 'compatibility: { transformer: "transform.ts" },',
  });
  context.after(() => removeFixture(fixture));
  const transformer = path.join(fixture.root, "transform.ts");
  const mutations = [
    `input.content.replace('</body>', '<template DATA-MOKLY-LINK-CHILD-END=""></template></body>')`,
    `input.content.replace('</body>', '<a DATA-MOKLY-LINK-CONTROL="button">Unrelated</a></body>')`,
    `input.content.replace('</body>', '<template><a data-mokly-link-control="span">Inert</a></template></body>')`,
    `input.content.replace('</head>', '<style DATA-MOKLY-LINK-CONTROL-STYLES=""></style></head>')`,
    `input.content.replace('data-mokly-link-control="button"', 'data-mokly-link-control="div"')`,
    `input.content.replace(' data-mokly-link-control="button"', '')`,
    `input.content.replace(' data-mokly-link-control="button"', '').replace('id="ordinary"', 'id="ordinary" data-mokly-link-control="button"')`,
    `input.content.replace('data-mokly-link-control="button"', 'data-mokly-link-control="button" DATA-MOKLY-LINK-CONTROL="div"')`,
    `input.content.replace('width:fit-content', 'width:100%')`,
    `input.content.replace('data-mokly-link-control-styles=""', 'data-mokly-link-control-styles="changed"')`,
    String.raw`input.content.replace(/<style data-mokly-link-control-styles="">[^]*?<\/style>/, '')`,
    `input.content.replace('id="ordinary"', 'id="ordinary" data-mokly-link-control-future=""')`,
  ];
  for (const expression of mutations) {
    await context.test(expression, async () => {
      await fs.writeFile(transformer, `export default input => ${expression};`);
      await assert.rejects(
        async () => compileCatalogue(await loadConfig(fixture.root)),
        /MockLink child control.*(unconsumed markers|metadata)/,
      );
    });
  }
});

test("compatibility cannot add control metadata to a document without child links", async (context) => {
  const fixture = await createFixture(validEntrySource(), {
    extraConfig: 'compatibility: { transformer: "transform.ts" },',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "transform.ts"),
    `export default input => input.content.replace('</body>', '<a DATA-MOKLY-LINK-CONTROL="a">Unrelated</a></body>');`,
  );
  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    /MockLink child control.*metadata/,
  );
});

test("compatibility preserves generated metadata while allowing harmless edits and literal names", async (context) => {
  const fixture = await createFixture(source, {
    extraConfig: 'compatibility: { transformer: "transform.ts" },',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "transform.ts"),
    `export default input => input.content
      .replaceAll(' data-mokly-link-control', ' DATA-MOKLY-LINK-CONTROL')
      .replaceAll('Continue', 'Next')
      .replace('</body>', '<p data-note="data-mokly-link-child-end">Literal metadata</p></body>');`,
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const html =
    textOutput(compilation.outputs, "screens/home.mobile.html") ?? "";
  assert.match(html, /DATA-MOKLY-LINK-CONTROL="button"/);
  assert.match(html, />Next<\/a>/);
  assert.match(html, /data-note="data-mokly-link-child-end"/);
});
