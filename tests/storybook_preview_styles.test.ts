import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  component,
  generated,
  htmlScreen,
} from "./fixtures/vite_stylesheets.js";
import { consumer } from "./helpers/mokly_serve.js";
import { build } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";

const rootPreview = "styles/dot-storybook/preview.tsx.css";
const packagePreview = "styles/packages/ui/dot-storybook/preview.tsx.css";
const configured = "styles/site.css";
const renderer = "styles/renderer.tsx.css";
const svg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><title>${label}</title></svg>`;
const story = `
export default { render: () => <p className="preview-theme">Story</p> };
export const Primary = {};
`;
const styleLinks = (html: string) =>
  [...html.matchAll(/<link rel="stylesheet" href="\.\.\/([^"]+)"/gu)].map(
    ([, link]) => link,
  );

for (const vite of [false, true]) {
  const adapter = vite ? "Vite" : "esbuild";

  test(`${adapter} links each folder's preview CSS in story order and delivers a dot-folder CSS asset`, async (context) => {
    const root = await consumer(context, {
      "mokly.config.json": JSON.stringify({
        vite,
        renderer: "renderer.tsx",
        roots: [
          { dir: "packages/ui/specs", storybook: "packages/ui/.storybook" },
          { dir: "specs" },
        ],
        stylesheets: [
          {
            match: "**",
            stylesheets: ["site.css"],
          },
        ],
      }),
      "renderer.tsx":
        'import "./renderer.css"; export default ({node}) => <main>{node}</main>;',
      "renderer.css":
        '@import "./renderer-tokens.css"; .renderer {display: block}',
      "renderer-tokens.css": ".renderer-tokens {color: blue}",
      "site.css": ".site {color: navy}",
      "packages/ui/.storybook/preview.tsx": `
import "./theme.css";
import "../../../renderer-tokens.css";
`,
      "packages/ui/.storybook/theme.css":
        '@import "./preview-tokens.css"; .preview-theme {color: teal; background: url("./.theme/theme.svg")}',
      "packages/ui/.storybook/preview-tokens.css":
        ".preview-tokens {color: olive}",
      "packages/ui/.storybook/.theme/theme.svg": svg("Theme image"),
      "packages/ui/specs/package.stories.tsx": `
import "../.storybook/preview-tokens.css";
import "../.storybook/theme.css";
import "./entry.css";
${story}
`,
      "packages/ui/specs/entry.css":
        '@import "../../../renderer-tokens.css"; @import "../.storybook/preview-tokens.css"; .entry {color: tomato}',
      ".storybook/preview.tsx": 'import "./global.css";',
      ".storybook/global.css": ".preview-theme {color: maroon}",
      "specs/default.stories.tsx": story,
      "specs/home.screen.html": htmlScreen,
      "specs/card.mockup.tsx": component("", "<p>Card</p>"),
    });
    await build(root, ["--no-changes", "--strict"], "plain", context.signal);

    const packageStory = await generated(root, "package/index.mobile.html");
    const entry = "styles/packages/ui/specs/package.stories.tsx.css";
    assert.deepEqual(styleLinks(packageStory), [
      configured,
      renderer,
      packagePreview,
      entry,
    ]);
    assert.match(packageStory, /class="preview-theme">Story<\/p>/u);
    const previewCss = await generated(root, packagePreview);
    assert.match(previewCss, /\.preview-theme\s*\{[^}]*color: teal/u);
    assert.match(previewCss, /\.preview-tokens\s*\{/u);
    assert.doesNotMatch(previewCss, /\.renderer-tokens\s*\{/u);
    const cssAsset = /url\("?([^")]+)"?\)/u.exec(previewCss)?.[1];
    assert.ok(cssAsset, previewCss);
    assert.equal(
      path.posix.join(path.posix.dirname(packagePreview), cssAsset),
      "assets/packages/ui/dot-storybook/dot-theme/theme.svg",
    );
    assert.equal(
      await generated(
        root,
        "assets/packages/ui/dot-storybook/dot-theme/theme.svg",
      ),
      svg("Theme image"),
    );
    const entryCss = await generated(root, entry);
    assert.doesNotMatch(entryCss, /\.preview-theme\s*\{/u);
    assert.match(entryCss, /\.entry\s*\{/u);
    for (const tokens of [
      /\.renderer-tokens\s*\{/gu,
      /\.preview-tokens\s*\{/gu,
    ])
      assert.equal(
        [...entryCss.matchAll(tokens)].length,
        vite ? 1 : 0,
        entryCss,
      );

    const defaultStory = await generated(root, "default/index.mobile.html");
    assert.deepEqual(styleLinks(defaultStory), [
      configured,
      renderer,
      rootPreview,
    ]);
    assert.match(
      await generated(root, rootPreview),
      /\.preview-theme\s*\{[^}]*color: maroon/u,
    );
    for (const entry of ["home", "card"])
      assert.deepEqual(
        styleLinks(await generated(root, `${entry}/index.mobile.html`)),
        [configured, renderer],
        entry,
      );
  });
}

test("a mapped preview stylesheet collides with a real dot-storybook route", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": JSON.stringify({
      stylesheets: [
        { match: "**", stylesheets: ["dot-storybook/preview.tsx.css"] },
      ],
    }),
    ".storybook/preview.tsx": 'import "./theme.css";',
    ".storybook/theme.css": ".preview-theme {color: teal}",
    "dot-storybook/preview.tsx.css": ".site {color: red}",
    "specs/default.stories.tsx": story,
  });
  const result = await command(
    root,
    "build",
    ["--no-changes"],
    "plain",
    {},
    context.signal,
  ).result;
  assert.equal(result.code, 1, result.stderr);
  assert.match(
    result.stderr,
    /stylesheet route collision: styles\/dot-storybook\/preview\.tsx\.css/u,
  );
});

test("CSS-free preview and entry modules link only their own stylesheets", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": JSON.stringify({
      roots: [{ dir: "specs" }, { dir: "src", files: ["a.tsx"] }],
      stylesheets: [
        {
          match: "home/index.html",
          stylesheets: ["dot-storybook/preview.tsx.css", "src/a.tsx.css"],
        },
      ],
    }),
    ".storybook/preview.tsx": "export default {};",
    "dot-storybook/preview.tsx.css": ".site {color: teal}",
    "src/a.tsx": component("", "<p>Card</p>"),
    "src/a.tsx.css": ".site {background: white}",
    "specs/default.stories.tsx": story,
    "specs/home.screen.html": htmlScreen,
  });
  await build(root, ["--no-changes", "--strict"], "plain", context.signal);

  const documents = await Promise.all(
    ["default", "card", "home"].map((entry) =>
      generated(root, `${entry}/index.mobile.html`),
    ),
  );
  assert.deepEqual(documents.map(styleLinks), [
    [],
    [],
    [rootPreview, "styles/src/a.tsx.css"],
  ]);
});

test("a preview with renderer-owned CSS keeps its route while a failed story keeps its inline stylesheet", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": JSON.stringify({ renderer: "renderer.tsx" }),
    "renderer.tsx":
      'import "./renderer.css"; export default ({node}) => <main>{node}</main>;',
    "renderer.css": ".renderer {color: blue}",
    ".storybook/preview.tsx": 'import "../renderer.css";',
    "specs/default.stories.tsx": `
export default { render: () => <p className="renderer">Story</p> };
export const Primary = {};
export const Failed = { render: () => { throw new Error("Story failed"); } };
`,
  });
  await build(root, ["--no-changes"], "plain", context.signal);
  const rendered = await generated(root, "default/index.mobile.html");
  assert.deepEqual(styleLinks(rendered), [renderer, rootPreview]);
  assert.equal(await generated(root, rootPreview), "\n");
  const html = await generated(root, "default/Failed/index.mobile.html");
  assert.match(html, /Story failed/u);
  assert.match(html, /<style>[\s\S]*\.mokly-story-error/u);
  assert.doesNotMatch(html, /rel="stylesheet"/u);
});

test("two CSS asset sources that map to the same route fail even when their bytes match", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": JSON.stringify({
      stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
    }),
    "theme.css": `
.one { background: url(".storybook/logo.svg") }
.two { background: url("dot-storybook/logo.svg") }
`,
    ".storybook/logo.svg": svg("Same image"),
    "dot-storybook/logo.svg": svg("Same image"),
    "specs/home.screen.html": htmlScreen,
  });
  const result = await command(
    root,
    "build",
    ["--no-changes"],
    "plain",
    {},
    context.signal,
  ).result;
  assert.equal(result.code, 1, result.stderr);
  assert.match(
    result.stderr,
    /output route collision: assets\/dot-storybook\/logo\.svg/u,
  );
});
