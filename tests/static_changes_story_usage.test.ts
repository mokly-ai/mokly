import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  currentDocumentPath,
  type ComponentWireValue,
  type EntryDetailV4,
} from "../packages/model/dist/index.js";
import { viewRoute } from "../packages/viewer/src/navigation/routes.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { build, git, json, write } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";

const badge = (implementation: string) => `
  export function Badge({ label, items }: {
    label?: string;
    items?: { label: string; onClick: () => void }[];
    depth?: unknown;
  }) {
    return <b data-badge={label === "Fixed" ? label : undefined}
      data-callback={items ? typeof items[0]?.onClick : undefined}>${implementation}</b>;
  }
  export function Repeated() {
    return <><Badge label="Fixed" /><Badge label="Fixed" /></>;
  }
`;

const screen = (output: string) => `
  import { defineScreen } from "@mokly/mokly";
  import { Badge, Repeated } from "./Badge.js";
  export default defineScreen({title: "Consumer", description: "", relatedDocs: [],
    render: () => ${output},
  });
`;

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} Changes separates story use inputs from component impact and counts numbered warnings`, async (context) => {
    const { root } = await viteFixture(context);
    await write(root, ".gitignore", "node_modules/\n.context/\n");
    await write(
      root,
      "mokly.config.json",
      JSON.stringify({
        vite,
        roots: [{ dir: "usage" }],
        review: { base: "fixture-base" },
        instanceNameProps: ["key", "", "data-identity"],
      }),
    );
    await write(root, "usage/Badge.tsx", badge("Before implementation"));
    await write(
      root,
      "usage/Badge_Story.stories.tsx",
      `
      import { Badge } from "./Badge.js";
      export default {title: "Badge", component: Badge};
      export const Default = {args: {label: "Own"}, render: (args) => <Badge {...args} />};
    `,
    );
    await write(
      root,
      "usage/composite.stories.tsx",
      `
      import { Repeated } from "./Badge.js";
      export default {title: "Composite"};
      export const Default = {render: () => <Repeated />};
    `,
    );
    const caller = (label: string) =>
      screen(`<Badge data-identity="edit" label="${label}" />`);
    const items = (label: string) =>
      screen(
        `<Badge key="items" items={[{ label: "${label}", onClick() {} }]} depth={depth} />`,
      ) +
      'const depth = Array.from({ length: 63 }).reduce<unknown>((value) => ({ nested: value }), "leaf");';
    await write(root, "usage/edit.mockup.tsx", caller("Old data"));
    await write(root, "usage/items.mockup.tsx", items("Old item"));
    await write(root, "usage/one.mockup.tsx", screen("<Repeated />"));
    await write(root, "usage/two.mockup.tsx", screen("<Repeated />"));
    for (const args of [
      ["init", "-q"],
      ["config", "user.name", "Mokly Test"],
      ["config", "user.email", "test@example.com"],
      ["add", "."],
      ["commit", "-qm", "base catalogue"],
      ["branch", "fixture-base"],
    ])
      await git(root, ...args);
    await write(root, "usage/Badge.tsx", badge("After implementation"));
    await write(root, "usage/edit.mockup.tsx", caller("New data"));
    await write(root, "usage/items.mockup.tsx", items("New item"));

    const result = await build(root, [], "plain");
    const component = result.index.components.find(
      ({ path }) => path === "Badge_Story",
    );
    assert.ok(component && "story" in component);
    assert.equal(component.story, true);
    assert.deepEqual(component.changes, {
      status: "ready",
      included: true,
      kind: "changed",
    });
    assert.deepEqual(
      result.index.screens.map(({ path, changes }) => [path, changes]),
      [
        ["edit", { status: "ready", included: true, kind: "changed" }],
        ["items", { status: "ready", included: true, kind: "changed" }],
        ["one", { status: "ready", included: false, kind: "unmodified" }],
        ["two", { status: "ready", included: false, kind: "unmodified" }],
      ],
    );
    const detail = (entry: string) =>
      json<EntryDetailV4>(result.output, `mokly-viewer/entries/${entry}.json`);
    const edited = await detail("edit");
    const input = edited.workspace!.inputChanges.find(
      ({ viewport, colorScheme }) =>
        viewport === "mobile" && colorScheme === "light",
    );
    assert.equal(input?.instanceId, "Badge_Story-edit");
    assert.deepEqual(input.before, {
      "data-identity": ["string", "edit"],
      label: ["string", "Old data"],
    });
    assert.deepEqual(input.after, {
      "data-identity": ["string", "edit"],
      label: ["string", "New data"],
    });
    const itemsDetail = await detail("items");
    const itemInput = itemsDetail.workspace!.inputChanges.find(
      ({ viewport, colorScheme }) =>
        viewport === "mobile" && colorScheme === "light",
    );
    assert.equal(itemInput?.instanceId, "Badge_Story-items");
    let depth: ComponentWireValue = ["string", "leaf"];
    for (let level = 0; level < 63; level++)
      depth = ["object", [["nested", depth]]];
    for (const [props, label] of [
      [itemInput.before, "Old item"],
      [itemInput.after, "New item"],
    ] as const) {
      assert.deepEqual(props, {
        depth,
        items: [
          "array",
          [
            [
              "object",
              [
                ["label", ["string", label]],
                ["onClick", ["string", "mokly:function"]],
              ],
            ],
          ],
        ],
      });
    }
    assert.match(
      await fs.readFile(
        path.join(
          result.output,
          currentDocumentPath(viewRoute("items", "mobile")),
        ),
        "utf8",
      ),
      /data-callback="function"/u,
    );
    const badgeDetail = await detail("Badge_Story");
    assert.deepEqual(
      new Set(badgeDetail.workspace!.usedBy?.map(({ entryPath }) => entryPath)),
      new Set(["composite", "edit", "items", "one", "two"]),
    );
    assert.deepEqual(
      new Set(
        badgeDetail.workspace!.affected?.map(({ entryPath }) => entryPath),
      ),
      new Set(["composite", "edit", "items", "one", "two"]),
    );
    const unchanged = await detail("one");
    assert.deepEqual(unchanged.workspace!.inputChanges, []);
    assert.equal(unchanged.workspace!.comparisonEligible, true);

    const warnings = (stderr: string) =>
      stderr.split("\n").filter((line) => line.includes("has a numbered id"));
    const numbered = warnings(result.stderr);
    const usage = unchanged.views[0]?.usage;
    assert.equal(usage?.status, "ready");
    const instance = usage.instances.find(({ id }) => id === "Badge_Story-2");
    assert.ok(instance);
    const site = instance.source
      ? ` at "usage/Badge.tsx":${instance.source.line}:${instance.source.column}`
      : "";
    const message = `component "Badge_Story" instance "Badge_Story-2"${site} has a numbered id; give the use a key that is unique in its input scope`;
    assert.deepEqual(numbered, [
      `[mokly/warning] component "composite": ${message}`,
      `[mokly/warning] entry "one": ${message}`,
      `[mokly/warning] entry "two": ${message}`,
    ]);
    const strict = await command(root, "build", [
      "--strict",
      "--no-changes",
      "--out=.context/strict",
    ]).result;
    assert.equal(strict.code, 1, strict.stderr);
    assert.deepEqual(warnings(strict.stderr), numbered);
    assert.match(strict.stderr, /3 build warnings with --strict/u);
    await assert.rejects(fs.stat(path.join(root, ".context/strict")), {
      code: "ENOENT",
    });
  });
}
