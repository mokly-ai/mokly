import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { currentDocumentPath } from "../packages/model/src/catalogue/delivery_paths.js";
import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import { decodeProps } from "../packages/viewer/src/components/codec.js";

import { consumer } from "./helpers/mokly_serve.js";
import { command } from "./helpers/static_publication.js";

async function strictBuild(context: TestContext, root: string) {
  const built = await command(
    root,
    "build",
    ["--no-changes", "--strict"],
    "plain",
    {},
    context.signal,
  ).result;
  assert.equal(built.code, 0, built.stderr);
  assert.equal(built.stderr, "");
  return readCatalogueIndex(
    JSON.parse(
      await fs.readFile(
        path.join(root, "mokly-static/mokly-viewer/index.json"),
        "utf8",
      ),
    ),
  );
}

test("Storybook Button template and excluded stories build with strict mode", async (context) => {
  const fixture = new URL("./fixtures/sidecar/", import.meta.url);
  const root = await consumer(context, {
    "specs/Button.tsx": await fs.readFile(
      new URL("storybook-template/Button.tsx", fixture),
      "utf8",
    ),
    "specs/Button.stories.tsx": await fs.readFile(
      new URL("storybook-template/Button.stories.tsx", fixture),
      "utf8",
    ),
    "specs/no-included.stories.tsx": await fs.readFile(
      new URL("no-included.stories.tsx", fixture),
      "utf8",
    ),
    "specs/no-exports.stories.tsx": await fs.readFile(
      new URL("no-exports.stories.tsx", fixture),
      "utf8",
    ),
  });
  const index = await strictBuild(context, root);
  assert.deepEqual(
    index.components
      .map(({ path, title }) => ({ path, title }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    [
      { path: "Button", title: "Button" },
      { path: "Button/Large", title: "Large" },
      { path: "Button/Secondary", title: "Secondary" },
      { path: "Button/Small", title: "Small" },
    ],
  );
  await context.test(
    "Button variants keep their own args and only the shared label is required",
    () => {
      for (const [entryPath, props] of [
        ["Button/Secondary", { label: "Button" }],
        ["Button/Large", { label: "Button", size: "large" }],
        ["Button/Small", { label: "Button", size: "small" }],
      ] as const) {
        const entry = index.components.find(({ path }) => path === entryPath);
        assert.ok(entry, entryPath);
        assert.deepEqual(decodeProps(entry.props), props, entryPath);
        assert.deepEqual(entry.propSchema.required, ["label"], entryPath);
      }
    },
  );
});

test("a meta without args builds the first included story as the parent only", async (context) => {
  const root = await consumer(context, {
    "specs/Avatar.stories.tsx": `
function Avatar({ name }: { name: string }) {
  return <span data-avatar="true">{name.trim()}</span>;
}
export default { component: Avatar };
export const Hidden = { tags: ["!mokly"] };
export const Zebra = { args: { name: "Zoe" } };
export const Alternate = { args: { name: "Ada" } };
`,
  });
  const index = await strictBuild(context, root);
  assert.deepEqual(
    index.components.map(({ path, props, propSchema }) => ({
      path,
      props: decodeProps(props),
      required: propSchema.required,
    })),
    [
      { path: "Avatar", props: { name: "Zoe" }, required: ["name"] },
      { path: "Avatar/Alternate", props: { name: "Ada" }, required: ["name"] },
    ],
  );
  const document = await fs.readFile(
    path.join(
      root,
      "mokly-static/static/mokly-generated/Avatar/index.mobile.html",
    ),
    "utf8",
  );
  assert.match(document, /<span data-avatar="true">Zoe<\/span>/);
});

test("malformed Storybook parameters warn per included page and fail strict builds", async (context) => {
  const root = await consumer(context, {
    ".storybook/preview.ts": String.raw`
export default { initialGlobals: { density: "default" } };
export const initialGlobals = { density: "named" };
export const parameters = {
  mokly: {
    "colourSchemes\ud800": {},
    viewports: { mobile: { density: "compact" } },
  },
};
`,
    "specs/nested/Globals.stories.tsx": String.raw`
export default {
  title: "Globals",
  render: (_args, { globals }) => (
    <output>{String(globals.theme)}/{String(globals.density)}</output>
  ),
  parameters: {
    mokly: {
      viewports: {
        desktop: [],
        ['tablet"\\\n\u0085\ud800']: {},
      },
      colorSchemes: { light: { theme: "light" }, dark: [], sepia: {} },
    },
  },
};
export const Excluded = { tags: ["!mokly"], parameters: { mokly: null } };
export const Primary = {};
export const InvalidMap = { parameters: { mokly: { colorSchemes: false } } };
export const InvalidRoot = { parameters: { mokly: [] } };
`,
  });
  const parent = "nested/Globals";
  const unknownField =
    'parameter "mokly.colourSchemes�" is ignored: unknown field';
  const invalidViewport =
    'parameter "mokly.viewports.desktop" is ignored: not an object';
  const unknownViewport = String.raw`parameter "mokly.viewports.tablet\"\\\u000a\u0085�" is ignored: unknown viewport`;
  const expected = [
    [parent, 'parameter "mokly.colorSchemes.dark" is ignored: not an object'],
    [
      parent,
      'parameter "mokly.colorSchemes.sepia" is ignored: unknown colour scheme',
    ],
    [parent, unknownField],
    [parent, invalidViewport],
    [parent, unknownViewport],
    [
      `${parent}/InvalidMap`,
      'parameter "mokly.colorSchemes" is ignored: not an object',
    ],
    [`${parent}/InvalidMap`, unknownField],
    [`${parent}/InvalidMap`, invalidViewport],
    [`${parent}/InvalidMap`, unknownViewport],
    [`${parent}/InvalidRoot`, 'parameter "mokly" is ignored: not an object'],
  ].map(([entry, message]) => `[mokly/warning] entry "${entry}": ${message}`);
  const build = (args: string[]) =>
    command(
      root,
      "build",
      ["--no-changes", ...args],
      "plain",
      {},
      context.signal,
    ).result;
  const warningLines = (stderr: string) =>
    stderr.split(/\r?\n/).filter((line) => line.startsWith("[mokly/warning] "));

  const built = await build([]);
  assert.equal(built.code, 0, built.stderr);
  assert.deepEqual(warningLines(built.stderr), expected);
  for (const [entry, markup] of [
    [parent, "<output>light/compact</output>"],
    [`${parent}/InvalidMap`, "<output>undefined/compact</output>"],
    [`${parent}/InvalidRoot`, "<output>undefined/default</output>"],
  ] as const) {
    const document = await fs.readFile(
      path.join(
        root,
        "mokly-static",
        currentDocumentPath(`${entry}/index.mobile.html`),
      ),
      "utf8",
    );
    assert.ok(document.includes(markup), `${entry} should render ${markup}`);
  }

  const strict = await build(["--strict"]);
  assert.equal(strict.code, 1, strict.stderr);
  assert.deepEqual(warningLines(strict.stderr), expected);
  assert.match(strict.stderr, /10 build warnings with --strict/);
});
