import assert from "node:assert/strict";
import test from "node:test";

import type { EntryDetailV4 } from "../packages/model/dist/index.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { build, json, write } from "./helpers/static_changes.js";

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} wrapper keys and repeats give recorded ids and numbered warnings`, async (context) => {
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
      "usage/consumer.mockup.tsx",
      `import { defineScreen } from "@mokly/mokly";
      import badge from "./Badge_Chip.mockup.js";
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
        </>,
      });`,
    );

    const result = await build(root, ["--no-changes"], "plain");
    const detail = await json<EntryDetailV4>(
      result.output,
      "mokly-viewer/entries/consumer.json",
    );
    const usage = detail.views[0]?.usage;
    assert.equal(usage?.status, "ready");
    const instances = usage.instances.toSorted(
      (left, right) => left.order - right.order,
    );
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
      ],
    );
    const warnings = result.stderr
      .split("\n")
      .filter((line) => line.includes("has a numbered id"));
    assert.deepEqual(
      warnings,
      [1, 3, 7, 8]
        .map((index) => {
          const { id, source } = instances[index]!;
          const site = source
            ? ` at "usage/consumer.mockup.tsx":${source.line}:${source.column}`
            : "";
          return `[mokly/warning] entry "consumer": component "Badge_Chip" instance "${id}"${site} has a numbered id; give the use a moklyInstance that is unique in its input scope`;
        })
        .sort(),
    );
  });
}
