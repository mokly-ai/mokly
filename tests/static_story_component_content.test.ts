import assert from "node:assert/strict";
import test from "node:test";

import type { EntryDetailV4 } from "../packages/model/dist/index.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { build, git, json, write } from "./helpers/static_changes.js";

function badge(implementation: string) {
  return `import { memo } from "react";
    export const Badge = memo(({ children }) => <section><b>${implementation}</b>{children}</section>);`;
}

function consumer(label: string) {
  return `import { defineScreen } from "@mokly/mokly";
import { Badge } from "./Badge.js";
const Body = () => <><Badge key="saved"><i>${label}</i></Badge><Badge key="saved"><i>Repeat</i></Badge></>;
export default defineScreen({ title: "Consumer", description: "", relatedDocs: [], render: Body });`;
}

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} Changes keeps supplied children and folds story implementation edits`, async (context) => {
    const { root } = await viteFixture(context);
    await write(root, ".gitignore", "node_modules/\n.context/\n");
    await write(
      root,
      "mokly.config.json",
      JSON.stringify({
        vite,
        roots: [{ dir: "usage" }],
        review: { base: "fixture-base" },
      }),
    );
    await write(root, "usage/Badge.tsx", badge("Before implementation"));
    await write(
      root,
      "usage/Badge.stories.tsx",
      `import { Badge } from "./Badge.js";
      export default { title: "Badge", component: Badge };
      export const Default = { render: () => <Badge><em>Own story</em></Badge> };`,
    );
    await write(root, "usage/consumer.mockup.tsx", consumer("Before child"));
    await write(
      root,
      "usage/affected.mockup.tsx",
      `import { defineScreen } from "@mokly/mokly";
      import { Badge } from "./Badge.js";
      export default defineScreen({ title: "Affected", description: "", relatedDocs: [],
        render: () => <Badge><i>Stable child</i></Badge> });`,
    );
    for (const args of [
      ["init", "-q"],
      ["config", "user.name", "Mokly Test"],
      ["config", "user.email", "test@example.com"],
      ["add", "."],
      ["commit", "-qm", "base catalogue"],
      ["branch", "fixture-base"],
    ])
      await git(root, ...args);

    const edited = consumer("After child 😀");
    await write(root, "usage/Badge.tsx", badge("After implementation"));
    await write(root, "usage/consumer.mockup.tsx", edited);
    const result = await build(root, [], "plain");
    assert.deepEqual(
      result.index.screens.map(({ path, changes }) => [path, changes]),
      [
        ["affected", { status: "ready", included: false, kind: "unmodified" }],
        ["consumer", { status: "ready", included: true, kind: "changed" }],
      ],
    );
    assert.deepEqual(
      result.index.components.find(({ path }) => path === "Badge")?.changes,
      {
        status: "ready",
        included: true,
        kind: "changed",
      },
    );
    const detail = (name: string) =>
      json<EntryDetailV4>(result.output, `mokly-viewer/entries/${name}.json`);
    const sourcePath = "usage/consumer.mockup.tsx";
    const sourceLine = edited.split("\n")[2]!;
    const column = sourceLine.lastIndexOf("<Badge") + 1;
    const usage = (await detail("consumer")).views[0]?.usage;
    assert.equal(usage?.status, "ready");
    assert.deepEqual(
      usage.instances.map(({ id, source }) => [id, source]).toSorted(),
      [
        [
          "Badge-saved",
          {
            path: sourcePath,
            line: 3,
            column: sourceLine.indexOf("<Badge") + 1,
          },
        ],
        ["Badge-saved-2", { path: sourcePath, line: 3, column }],
      ],
    );
    assert.deepEqual(
      usage.slots.map(({ name }) => name),
      ["children-0", "children-0"],
    );
    assert.deepEqual(
      (await detail("Badge")).workspace?.affected
        ?.map(({ entryPath }) => entryPath)
        .toSorted(),
      ["affected", "affected", "consumer", "consumer", "consumer", "consumer"],
    );
    assert.deepEqual(
      result.stderr
        .split("\n")
        .filter((line) => line.includes("has a numbered id")),
      [
        `[mokly/warning] entry "consumer": component "Badge" instance "Badge-saved-2" at "${sourcePath}":3:${column} has a numbered id; give the use a key that is unique in its input scope`,
      ],
    );
  });
}
