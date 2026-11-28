import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { component, generated } from "./fixtures/vite_stylesheets.js";
import { consumer } from "./helpers/mokly_serve.js";
import { link } from "./helpers/native_resolution.js";
import { build } from "./helpers/static_changes.js";

const markup = "<p className={styles.card}>Card</p>";
const moduleCss = ".card { color: teal }";

function story(imports: string) {
  return `${imports}
export default { render: () => ${markup} };
export const Primary = {};
`;
}

async function checkModuleSelector(
  root: string,
  earlier: string,
  entry: string,
) {
  const document = await generated(root, "card/index.mobile.html");
  const name = /<p class="(mokly_[\w-]+)">Card<\/p>/u.exec(document)?.[1];
  assert.ok(name, document);
  assert.deepEqual(
    [...document.matchAll(/<link rel="stylesheet" href="\.\.\/([^"]+)"/gu)].map(
      ([, href]) => href,
    ),
    [earlier, entry],
  );
  const entryCss = await generated(root, entry);
  assert.ok(entryCss.includes(`.${name} {`), entryCss);
  return { entryCss, earlierCss: await generated(root, earlier) };
}

const catalogue = "packages/catalogue";
const storybook = `${catalogue}/.storybook`;
const renderer = `${catalogue}/renderer.tsx`;
const specs = `${catalogue}/specs`;
const theme = "packages/theme";

for (const installation of ["workspace", "pnpm"]) {
  for (const owner of ["preview", "renderer"]) {
    test(`esbuild keeps the rendered CSS Module selector through a ${installation} link after the ${owner}`, async (context) => {
      const preview = owner === "preview";
      const entry = `${specs}/card.${preview ? "stories" : "mockup"}.tsx`;
      const packageLink =
        installation === "workspace"
          ? `${catalogue}/node_modules/theme`
          : `${catalogue}/node_modules/.pnpm/wrapper@1.0.0/node_modules/theme`;
      const cssImport =
        installation === "workspace"
          ? "theme"
          : `./${path.posix.relative(catalogue, packageLink)}`;
      const jsImport =
        installation === "workspace"
          ? "theme"
          : path.posix.relative(specs, packageLink);
      const imports = `import styles from "${jsImport}/style.module.css"; import "${jsImport}/plain.css";`;
      const root = await consumer(context, {
        "mokly.config.json": JSON.stringify({
          roots: [{ dir: specs, storybook: preview ? storybook : undefined }],
          renderer: preview ? undefined : renderer,
        }),
        [`${theme}/package.json`]: '{"name":"theme","version":"1.0.0"}',
        [`${theme}/style.module.css`]: moduleCss,
        [`${theme}/plain.css`]: ".shared-style { display: block }",
        [`${catalogue}/shared.css`]: `@import "${cssImport}/style.module.css"; @import "${cssImport}/plain.css";`,
        ...(preview
          ? { [`${storybook}/preview.tsx`]: 'import "../shared.css";' }
          : {
              [renderer]:
                'import "./shared.css"; export default ({node}) => <main>{node}</main>;',
            }),
        [entry]: preview ? story(imports) : component(imports, markup),
      });
      await link(path.join(root, theme), path.join(root, packageLink));
      await build(
        root,
        ["--no-changes", "--strict", "--sidecars=1"],
        "plain",
        context.signal,
      );

      const earlier = preview
        ? `styles/${catalogue}/dot-storybook/preview.tsx.css`
        : `styles/${renderer}.css`;
      const { earlierCss, entryCss } = await checkModuleSelector(
        root,
        earlier,
        `styles/${entry}.css`,
      );
      assert.match(earlierCss, /\.shared-style\s*\{/u);
      assert.doesNotMatch(entryCss, /\.shared-style\s*\{/u);
    });
  }
}

test("Vite keeps the scoped story selector when the preview inlines the CSS Module", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": JSON.stringify({ vite: true }),
    ".storybook/preview.tsx": 'import "./theme.css";',
    ".storybook/theme.css": '@import "../specs/card.module.css";',
    "specs/card.module.css": moduleCss,
    "specs/card.stories.tsx": story('import styles from "./card.module.css";'),
  });
  await build(
    root,
    ["--no-changes", "--strict", "--sidecars=1"],
    "plain",
    context.signal,
  );

  const { earlierCss } = await checkModuleSelector(
    root,
    "styles/dot-storybook/preview.tsx.css",
    "styles/specs/card.stories.tsx.css",
  );
  assert.match(earlierCss, /\.card\s*\{[^}]*color: teal/u);
});
