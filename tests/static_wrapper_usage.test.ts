import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { EntryDetailV4 } from "../packages/model/dist/index.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { json, write } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} records the same story and wrapper uses with NODE_ENV=production`, async (context) => {
    const { root } = await viteFixture(context);
    await write(
      root,
      "mokly.config.json",
      JSON.stringify({ vite, roots: [{ dir: "usage" }] }),
    );
    await write(
      root,
      "usage/Badge_Chip.mockup.tsx",
      `import { defineComponent } from "@mokly/mokly";
      export default defineComponent({
        title: "Badge", description: "", relatedDocs: [],
        propSchema: { type: "object", additionalProperties: false,
          properties: { label: { type: "string" } }, required: ["label"] },
        props: { label: "Saved" },
        render: ({ label }) => <b>{label}</b>,
      });`,
    );
    await write(
      root,
      "usage/Pill.stories.tsx",
      `export function Pill({ label }: { label: string }) {
        return <i>{label}</i>;
      }
      export default { title: "Pill", component: Pill };
      export const Saved = { args: { label: "Saved" } };`,
    );
    const consumerPath = "usage/consumer.mockup.tsx";
    await write(
      root,
      consumerPath,
      `import { defineScreen } from "@mokly/mokly";
      import badge from "./Badge_Chip.mockup.js";
      import { Pill } from "./Pill.stories.js";
      export default defineScreen({ title: "Consumer", description: "", relatedDocs: [],
        render: () => <>
          <badge.Component key="ignored" moklyInstance="explicit" label="Explicit" />
          <badge.Component moklyInstance="explicit" label="Repeated explicit" />
          <badge.Component key="Café" label="Key" />
          <badge.Component key="cafe" label="Repeated key" />
          <badge.Component {...{ key: "With spread", label: "Spread" }} />
          <badge.Component key={3} label="Three" />
          <badge.Component label="First" />
          <badge.Component label="Second" />
          <badge.Component label="Fourth" />
          <Pill key="saved" label="Saved" />
          <Pill key="saved" label="Saved again" />
        </>,
      });`,
    );

    const readUsage = async (mode: string, nodeEnv?: string) => {
      const out = `.context/${mode}`;
      const result = await command(
        root,
        "build",
        ["--no-changes", `--out=${out}`],
        "plain",
        { NODE_ENV: nodeEnv },
      ).result;
      assert.equal(result.code, 0, result.stderr);
      const detail = await json<EntryDetailV4>(
        path.join(root, out),
        "mokly-viewer/entries/consumer.json",
      );
      const usage = detail.views[0]?.usage;
      assert.equal(usage?.status, "ready");
      return {
        instances: usage.instances.toSorted(
          (left, right) => left.order - right.order,
        ),
        warnings: result.stderr
          .split("\n")
          .filter((line) => line.includes("has a numbered id")),
      };
    };
    const baseline = await readUsage("default");
    const production = await readUsage("production", "production");
    assert.deepEqual(
      production.instances
        .filter(({ componentId }) => componentId === "Pill")
        .map(({ id }) => id),
      ["Pill-saved", "Pill-saved-2"],
      "production story component ids",
    );
    const { instances, warnings } = baseline;
    assert.deepEqual(
      instances.map(({ id, props }) => [id, props]),
      [
        ["explicit", { label: ["string", "Explicit"] }],
        ["explicit-2", { label: ["string", "Repeated explicit"] }],
        ["Badge_Chip-cafe", { label: ["string", "Key"] }],
        ["Badge_Chip-cafe-2", { label: ["string", "Repeated key"] }],
        ["Badge_Chip-with-spread", { label: ["string", "Spread"] }],
        ["Badge_Chip-3", { label: ["string", "Three"] }],
        ["Badge_Chip", { label: ["string", "First"] }],
        ["Badge_Chip-2", { label: ["string", "Second"] }],
        ["Badge_Chip-4", { label: ["string", "Fourth"] }],
        ["Pill-saved", { label: ["string", "Saved"] }],
        ["Pill-saved-2", { label: ["string", "Saved again"] }],
      ],
    );
    assert.deepEqual(
      instances.map(({ source }) => source),
      [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((line) => ({
        path: consumerPath,
        line,
        column: 11,
      })),
    );
    assert.deepEqual(
      warnings,
      [1, 3, 7, 8, 10]
        .map((index) => {
          const { id, componentId, source } = instances[index]!;
          assert.ok(source);
          const hint = componentId === "Pill" ? "key" : "moklyInstance";
          const site = ` at "${source.path}":${source.line}:${source.column}`;
          return `[mokly/warning] entry "consumer": component "${componentId}" instance "${id}"${site} has a numbered id; give the use a ${hint} that is unique in its input scope`;
        })
        .sort(),
    );
    assert.deepEqual(production, baseline);
  });
}
