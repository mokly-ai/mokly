import assert from "node:assert/strict";
import test from "node:test";

import {
  broadRebuildFixture,
  postcssConfig,
  postcssFixture,
  rebuildFixture,
  setups,
  withSetupWatch,
} from "./fixtures/vite_setup_watch.js";

test("a Vite rebuild rule reloads setup on input edits and membership changes", async (context) => {
  const root = await rebuildFixture(context, true);
  await withSetupWatch(
    context,
    root,
    async ({ publish, read, write, remove }) => {
      const render = () => read("card/index.mobile.html");
      assert.match(await render(), /<p>before<\/p>/);
      await publish(() => write("data/copy.txt", "edited"));
      assert.match(await render(), /<p>edited<\/p>/);
      await publish(() => write("data/more.txt", "added"));
      assert.match(await render(), /<p>edited\|added<\/p>/);
      await publish(() => remove("data/more.txt"));
      assert.match(await render(), /<p>edited<\/p>/);
    },
  );
});

test("Vite gives an imported helper precedence over a broad rebuild rule", async (context) => {
  const root = await broadRebuildFixture(context);
  await withSetupWatch(context, root, async ({ publish, read, write }) => {
    const card = () => read("card/index.mobile.html");
    const other = () => read("other/index.mobile.html");
    const stylesheet = () => read("styles/src/site.css");
    assert.match(await card(), /<p>helper-before\|before<\/p>/);
    assert.match(await other(), /<p>other\|before<\/p>/);
    assert.match(await stylesheet(), /color:\s*teal/);
    assert.equal(await setups(root), "setup\n");
    await publish(() =>
      write("src/helper.ts", 'export const label = "helper-after";'),
    );
    assert.match(await card(), /<p>helper-after\|before<\/p>/);
    assert.match(await other(), /<p>other\|before<\/p>/);
    assert.equal(await setups(root), "setup\n");
    await publish(() => write("src/site.css", ".card { color: maroon }"));
    assert.match(await stylesheet(), /color:\s*maroon/);
    assert.equal(await setups(root), "setup\n");
    await publish(() => write("src/copy.json", '{"copy":"after"}'));
    assert.match(await card(), /<p>helper-after\|after<\/p>/);
    assert.match(await other(), /<p>other\|after<\/p>/);
    assert.equal(await setups(root), "setup\nsetup\n");
  });
});

test("esbuild still rebuilds the catalogue for the same watch rule", async (context) => {
  const root = await rebuildFixture(context, false);
  await withSetupWatch(context, root, async ({ publish, read, write }) => {
    const before = await read("card/index.mobile.html");
    assert.match(before, /<p>esbuild<\/p>/);
    await publish(() => write("data/copy.txt", "edited"));
    assert.equal(await read("card/index.mobile.html"), before);
  });
});

test("Vite picks up an added, edited, and removed PostCSS config in one Serve process", async (context) => {
  const root = await postcssFixture(context);
  await withSetupWatch(
    context,
    root,
    async ({ publish, read, write, remove }) => {
      const file = "tools/postcss.config.cjs";
      const stylesheet = () => read("styles/styles/site.css");
      assert.match(await stylesheet(), /color:\s*teal/);
      await publish(() => write(file, postcssConfig("maroon")));
      assert.match(await stylesheet(), /color:\s*maroon/);
      await publish(() => write(file, postcssConfig("indigo")));
      assert.match(await stylesheet(), /color:\s*indigo/);
      await publish(() => remove(file));
      assert.match(await stylesheet(), /color:\s*teal/);
    },
  );
});
