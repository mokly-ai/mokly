import assert from "node:assert/strict";
import test from "node:test";

import type { EntryDetailV4 } from "../packages/model/dist/index.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { build, git, json, write } from "./helpers/static_changes.js";

function components(text: string) {
  return `
export function Stable({ children }) { return <section>{children}</section>; }
export function Edited({ children }) { return <section><b>${text}</b>{children}</section>; }
export function Inner() { return <b>${text}</b>; }
export function Outer() { return <section><Inner /></section>; }
export function Toggle() { return <section>Stable output</section>; }
export function Invalid({ children }) { return <section>{children}</section>; }
`;
}

function story(component: string, contentSlots?: boolean | string) {
  const parameters =
    contentSlots === undefined
      ? ""
      : `, parameters: { mokly: { contentSlots: ${JSON.stringify(contentSlots)} } }`;
  return `import { ${component} } from "./components.js";
export default { title: "${component}", component: ${component}${parameters} };
export const Main = { render: () => <${component} /> };`;
}

function consumer(component: string, child?: string) {
  const element =
    child === undefined
      ? `<${component} />`
      : `<${component}><a>${child}</a></${component}>`;
  return `import { defineScreen } from "@mokly/mokly";
import { ${component} } from "./components.js";
export default defineScreen({ title: "Uses ${component}", description: "", relatedDocs: [], render: () => ${element} });`;
}

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} Changes compares transparent story uses and still projects their nested instances`, async (context) => {
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
    await write(root, "usage/components.tsx", components("Before"));
    for (const [component, contentSlots] of [
      ["Stable", false],
      ["Edited", false],
      ["Inner", undefined],
      ["Outer", false],
      ["Toggle", true],
      ["Invalid", "false"],
    ] as const)
      await write(
        root,
        `usage/${component}.stories.tsx`,
        story(component, contentSlots),
      );
    for (const [name, component, child] of [
      ["supplied", "Stable", "Before child"],
      ["implementation", "Edited", "Same child"],
      ["nested", "Outer"],
      ["switch", "Toggle"],
      ["malformed", "Invalid", "Uses the default"],
    ] as const)
      await write(root, `usage/${name}.mockup.tsx`, consumer(component, child));
    for (const args of [
      ["init", "-q"],
      ["config", "user.name", "Mokly Test"],
      ["config", "user.email", "test@example.com"],
      ["add", "."],
      ["commit", "-qm", "base catalogue"],
      ["branch", "fixture-base"],
    ])
      await git(root, ...args);

    await write(root, "usage/components.tsx", components("After"));
    await write(
      root,
      "usage/supplied.mockup.tsx",
      consumer("Stable", "After child"),
    );
    await write(root, "usage/Toggle.stories.tsx", story("Toggle", false));
    const result = await build(root, [], "plain");
    const changed = { status: "ready", included: true, kind: "changed" };
    const unmodified = { status: "ready", included: false, kind: "unmodified" };
    assert.deepEqual(
      result.index.screens.map(({ path, changes }) => [path, changes]),
      [
        ["implementation", changed],
        ["malformed", unmodified],
        ["nested", unmodified],
        ["supplied", changed],
        ["switch", changed],
      ],
    );
    assert.deepEqual(
      result.index.components.find(({ path }) => path === "Edited")?.changes,
      changed,
    );
    const detail = (path: string) =>
      json<EntryDetailV4>(result.output, `mokly-viewer/entries/${path}.json`);
    assert.deepEqual(
      new Set(
        (await detail("Edited")).workspace?.usedBy?.map(
          ({ entryPath }) => entryPath,
        ),
      ),
      new Set(["implementation"]),
    );
    const usage = (await detail("malformed")).views[0]?.usage;
    assert.equal(usage?.status, "ready");
    assert.deepEqual(
      usage.slots.map(({ name }) => name),
      ["children-0"],
    );
    assert.deepEqual(
      result.stderr
        .split("\n")
        .filter((line) => line.includes('parameter "mokly.contentSlots"')),
      [
        '[mokly/warning] entry "Invalid": parameter "mokly.contentSlots" is ignored: not a boolean',
      ],
    );
  });
}
