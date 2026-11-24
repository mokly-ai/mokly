import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

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
