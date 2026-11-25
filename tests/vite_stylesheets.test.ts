import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  component,
  generated,
  htmlScreen,
  stylesheetBuild,
  stylesheetConfig,
} from "./fixtures/vite_stylesheets.js";
import { consumer } from "./helpers/mokly_serve.js";

test("Vite transforms a component's Sass imports and declared stylesheet", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig([], { postcss: "mokly-postcss.cjs" }),
    "vite.config.ts":
      'export default { css: { modules: { localsConvention: "camelCaseOnly" }, preprocessorOptions: { scss: { additionalData: "$surface: teal;\\n" } } } };',
    "mokly-postcss.cjs":
      'throw new Error("Mokly PostCSS must not run with Vite");',
    "postcss.config.cjs": `module.exports = { plugins: [{ postcssPlugin: 'rename-property',
      Declaration: { 'mokly-color': (node) => { node.prop = 'color'; } },
    }] };`,
    "src/card.mockup.tsx": component(
      'import "./plain.scss"; import styles from "./card.module.scss";',
      "<p className={styles.cardFace}>Card</p>",
      "declared.scss",
    ),
    "src/plain.scss": ".plain { color: $surface }",
    "src/card.module.scss": ".card-face { color: $surface }",
    "declared.scss": ".declared { mokly-color: $surface }",
  });
  const built = await stylesheetBuild(root);
  assert.equal(built.code, 0, built.stderr);
  const hash = createHash("sha256")
    .update("src/card.module.scss")
    .digest("hex")
    .slice(0, 12);
  const scoped = `mokly_${hash}_card-face`;
  const html = await generated(root, "card/index.mobile.html");
  const css = await generated(root, "styles/src/card.mockup.tsx.css");
  assert.match(html, new RegExp(`class="${scoped}"`));
  assert.match(css, new RegExp(`\\.${scoped}\\s*\\{[^}]*color:\\s*teal`));
  assert.match(css, /\.plain\s*\{[^}]*color:\s*teal/);
  assert.match(html, /href="[^"]*styles\/declared\.scss\.css"/);
  assert.match(
    await generated(root, "styles/declared.scss.css"),
    /\.declared\s*\{[^}]*color:\s*teal/,
  );
});

test("Vite renders its own CSS Module named bindings", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig([]),
    "src/card.mockup.tsx": component(
      'import styles, { class as className, __esModule as esmClass } from "./card.module.css"; import * as bindings from "./card.module.css";',
      '<p className={className} data-esm={esmClass} data-default={styles["btn-primary"]} data-named={"btn-primary" in bindings}>Card</p>',
    ),
    "src/card.module.css":
      ".class { color: teal } .btn-primary { display: block } .__esModule { display: inline }",
  });
  const built = await stylesheetBuild(root);
  assert.equal(built.code, 0, built.stderr);
  const html = await generated(root, "card/index.mobile.html");
  const scoped = /<p class="(mokly_[a-f0-9]{12}_class)"/.exec(html)?.[1];
  assert.ok(scoped, html);
  assert.match(
    html,
    /data-esm="mokly_[a-f0-9]{12}___esModule" data-default="mokly_[a-f0-9]{12}_btn-primary" data-named="false"/,
  );
  assert.match(
    await generated(root, "styles/src/card.mockup.tsx.css"),
    new RegExp("\\." + scoped + "\\s*\\{[^}]*color:\\s*teal"),
  );
});

test("Vite delivers Tailwind utilities used by a component", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig(["theme.css"]),
    "vite.config.ts":
      'import tailwindcss from "@tailwindcss/vite"; export default { plugins: [tailwindcss()] };',
    "src/card.mockup.tsx": component("", '<p className="grid-cols-3">Card</p>'),
    "theme.css": '@import "tailwindcss" source(none);\n@source "./src";',
  });
  const built = await stylesheetBuild(root);
  assert.equal(built.code, 0, built.stderr);
  assert.match(
    await generated(root, "styles/theme.css"),
    /\.grid-cols-3\s*\{[^}]*grid-template-columns:\s*repeat\(3,/,
  );
});

test("Vite prunes the renderer closure from JavaScript imports but keeps CSS imports", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig([], { renderer: "renderer.jsx" }),
    "src/card.mockup.tsx": component(
      'import "../tokens.css"; import "./entry.css";',
      '<p className="entry">Card</p>',
    ),
    "renderer.jsx":
      'import "./renderer.css"; import "./shared.css"; export default ({node}) => <main>{node}</main>;',
    "renderer.css": '@import "./tokens.css"; .renderer { color: red }',
    "tokens.css": ".tokens { color: teal }",
    "shared.css": ".shared { color: green }",
    "src/entry.css": '@import "../shared.css"; .entry { color: blue }',
  });
  const built = await stylesheetBuild(root);
  assert.equal(built.code, 0, built.stderr);
  const renderer = await generated(root, "styles/renderer.jsx.css");
  const entry = await generated(root, "styles/src/card.mockup.tsx.css");
  assert.match(renderer, /\.tokens/);
  assert.doesNotMatch(entry, /\.tokens/);
  assert.match(entry, /\.shared[\s\S]*\.entry/);
  assert.match(
    await generated(root, "card/index.mobile.html"),
    /styles\/renderer\.jsx\.css[\s\S]*styles\/src\/card\.mockup\.tsx\.css/,
  );
});

test("Vite preserves the asset of an inlined stylesheet at its authored path", async (context) => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g id="mark"/></svg>';
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig(["theme.css"]),
    "vite.config.ts": `export default { base: '/app/', plugins: [{name: 'mark', transform(css, id) {
      if (id.endsWith('theme.css?inline')) return css.replace('.site', '.marked');
    }}] };`,
    "src/home.screen.html": htmlScreen,
    "theme.css": '@import "./art/background.css";',
    "art/background.css": '.site { background: url("./icon.svg#mark"); }',
    "art/icon.svg": svg,
  });
  const built = await stylesheetBuild(root);
  assert.equal(built.code, 0, built.stderr);
  assert.match(
    await generated(root, "styles/theme.css"),
    /\.marked\s*\{[^}]*\.\.\/assets\/art\/icon\.svg#mark/,
  );
  assert.equal(await generated(root, "assets/art/icon.svg"), svg);
});

test("Vite transforms configured Sass in a catalogue without JavaScript", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig(["site.scss"]),
    "src/home.screen.html": htmlScreen,
    "site.scss": "$ink: teal; .site { color: $ink }",
  });
  const built = await stylesheetBuild(root);
  assert.equal(built.code, 0, built.stderr);
  assert.match(
    await generated(root, "home/index.mobile.html"),
    /href="[^"]*styles\/site\.scss\.css"/,
  );
  assert.match(
    await generated(root, "styles/site.scss.css"),
    /\.site\s*\{[^}]*color:\s*teal/,
  );
});

test("Vite reports a configured Sass and CSS route collision", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig(["a.scss", "a.scss.css"]),
    "src/home.screen.html": htmlScreen,
    "a.scss": ".sass { color: teal }",
    "a.scss.css": ".css { color: blue }",
  });
  const built = await stylesheetBuild(root);
  assert.notEqual(built.code, 0);
  assert.match(
    built.stderr,
    /stylesheet route collision: styles\/a\.scss\.css; rename one of the files whose stylesheets share this route/,
  );
});

test("Vite reports a stylesheet transform failure with its logical path", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig(["site.scss"]),
    "src/home.screen.html": htmlScreen,
    "site.scss": ".site { color: teal }",
    "vite.config.ts": `export default { plugins: [{ name: 'reject-style', transform(_code, id) {
      if (id.endsWith('site.scss?inline')) this.error('cannot transform '+id+' (virtual:style)');
    } }] };`,
  });
  const built = await stylesheetBuild(root);
  assert.notEqual(built.code, 0);
  assert.match(
    built.stderr,
    /Vite plugin reject-style failed for site\.scss: cannot transform site\.scss \(site\.scss\); fix the Vite setup or the stylesheet/,
  );
  assert.ok(!built.stderr.includes(root), built.stderr);
  assert.doesNotMatch(built.stderr, /virtual:/);
});

test("Vite protects a stylesheet dependency that a document references", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig(["styles/site.css"]),
    "src/home.screen.html":
      htmlScreen + '<img src="../../images/logo.svg" alt="Logo">',
    "images/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    "styles/site.css": ".site { color: teal }",
    "vite.config.ts": `import { resolve } from 'node:path';
export default { plugins: [{ name: 'report-logo', transform(_code, id) {
  if (id.endsWith('styles/site.css?inline'))
    this.addWatchFile(resolve(import.meta.dirname, 'images/logo.svg'));
} }] };`,
  });
  const built = await stylesheetBuild(root);
  assert.notEqual(built.code, 0, built.stderr);
  assert.ok(
    built.stderr.includes(
      'protected target ../../images/logo.svg: the Vite setup reported it as a dependency of styles/site.css; exclude it from the plugin\'s sources (Tailwind: @source not "../images/logo.svg")',
    ),
    built.stderr,
  );
});

test("Vite rejects a declared stylesheet with an uppercase suffix", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig([]),
    "src/card.mockup.tsx": component("", "<p>Card</p>", "Action.CSS"),
    "Action.CSS": ".card { color: teal }",
  });
  const built = await stylesheetBuild(root);
  assert.notEqual(built.code, 0, built.stderr);
  assert.match(
    built.stderr,
    /Vite plugin vite failed for Action\.CSS: Vite reads only a lowercase stylesheet suffix; fix the Vite setup or the stylesheet/,
  );
});

test("Vite protects a composed stylesheet as an import of its CSS Module", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig(["styles/site.module.css"]),
    "src/home.screen.html":
      htmlScreen + '<a href="../../styles/colors.css">Colors</a>',
    "styles/site.module.css":
      '.site { composes: shared from "./shared.module.css"; display: block }',
    "styles/shared.module.css":
      '.shared { composes: shade from "./colors.css"; color: teal }',
    "styles/colors.css": ".shade { background: blue }",
  });
  const built = await stylesheetBuild(root);
  assert.notEqual(built.code, 0, built.stderr);
  assert.ok(
    built.stderr.includes(
      "protected target ../../styles/colors.css: imported by styles/shared.module.css; reference the delivered route under static/mokly-generated/ or keep a separate public copy",
    ),
    built.stderr,
  );
});

test("Vite rejects a declaration that does not name a stylesheet", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig([]),
    "src/card.mockup.tsx": component("", "<p>Card</p>", "notes.txt"),
    "notes.txt": "Not a stylesheet",
  });
  const built = await stylesheetBuild(root);
  assert.notEqual(built.code, 0, built.stderr);
  assert.match(
    built.stderr,
    /component card declares invalid stylesheet notes\.txt/,
  );
});
