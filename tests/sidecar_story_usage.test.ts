import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { viteFixture } from "./fixtures/vite/support.js";
import {
  installBindings,
  sidecarFixture,
  startSidecar,
} from "./helpers/sidecar.js";

for (const { name, vite, forceProductionJsx } of [
  { name: "esbuild", vite: false },
  { name: "Vite", vite: true },
  {
    name: "Vite with a production JSX plugin",
    vite: true,
    forceProductionJsx: true,
  },
]) {
  test(`${name} records rendered story components and their wrappers`, async (context) => {
    const { root, params } = await viteFixture(context);
    await fs.cp(
      path.join(sidecarFixture, "story-usage"),
      path.join(root, "usage"),
      {
        recursive: true,
      },
    );
    if (forceProductionJsx)
      await fs.writeFile(
        path.join(root, "vite.config.ts"),
        `import { transformWithOxc } from "vite";
        export default { plugins: [{
          name: "force-production-jsx",
          enforce: "pre",
          async transform(code, id) {
            if (!id.endsWith("/usage/screen.mockup.tsx")) return;
            const result = await transformWithOxc(code, id, {
              jsx: { runtime: "automatic", development: false },
            });
            return { code: result.code, map: result.map };
          },
        }] };`,
      );
    const sidecar = startSidecar(context, root, {
      ...process.env,
      NODE_ENV: undefined,
    });
    await sidecar.call("hello");
    const { generation } = await sidecar.call<BundleResult>("bundle", {
      ...params,
      vite,
      renderer: null,
      entryFiles: ["usage/screen.mockup.tsx"],
      storiesFiles: [
        "usage/alias.stories.tsx",
        "usage/button.stories.tsx",
        "usage/field.stories.tsx",
      ],
    });
    await sidecar.call("cssModules", { generation, classMaps: {} });
    const bindings = await installBindings(sidecar, generation, {
      "usage/button.stories.tsx#default": {
        path: "Card_Button",
        title: "Button",
      },
      "usage/alias.stories.tsx#default": {
        path: "z-alias",
        title: "Button alias",
      },
    });
    const axes = {
      generation,
      viewport: "mobile",
      colorScheme: "light",
    };
    const handle = "usage/screen.mockup.tsx#default";
    const result = await sidecar.call<RenderResult>("renderScreen", {
      ...axes,
      props: {},
      handle,
      entry: bindings[handle],
    });
    assert.deepEqual(
      result.instances.map(({ id, componentPath, order, numbered = false }) => [
        id,
        componentPath,
        order,
        numbered,
      ]),
      [
        ["Card_Button-cafe-save", "Card_Button", 0, false],
        ["Card_Button", "Card_Button", 1, false],
        ["Card_Button-2", "Card_Button", 2, true],
        ["Card_Button-2-2", "Card_Button", 3, true],
        ["field-bare", "field", 4, false],
        ["Card_Button-saved", "Card_Button", 5, false],
      ],
    );
    assert.deepEqual(result.instances[0]?.props, {
      id: ["string", "original-id"],
      label: ["string", "Memo"],
    });
    const sites = [
      [17, 9],
      [23, 9],
      [24, 9],
      [25, 9],
      [26, 9],
      [7, 15],
    ];
    assert.deepEqual(
      result.instances.map(({ source }) => source),
      sites.map(([line, column]) =>
        forceProductionJsx
          ? undefined
          : { path: "usage/screen.mockup.tsx", line, column },
      ),
    );
    assert.deepEqual(result.slots, []);
    assert.match(
      result.html,
      /<button id="original-id">Original callback<\/button>/u,
    );
    assert.match(
      result.html,
      /<button>Created directly<\/button><button>Key after spread<\/button>/u,
    );
    const story = await sidecar.call<RenderResult>("renderStory", {
      ...axes,
      storyId: "usage/button.stories.tsx#Variant",
      props: { label: "Variant" },
    });
    assert.deepEqual(
      story.instances.map(({ id }) => id),
      ["field-related"],
    );
    assert.match(story.html, /^<button>Variant<\/button>/u);
    const alias = await sidecar.call<RenderResult>("renderStory", {
      ...axes,
      storyId: "usage/alias.stories.tsx#default",
      props: { label: "Alias" },
    });
    assert.deepEqual(alias.instances, []);
  });
}
