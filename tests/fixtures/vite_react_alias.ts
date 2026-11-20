import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";

import { viteFixture } from "./vite/support.js";

export type ReactAlias = "same" | "second" | "string";

export async function reactAliasFixture(
  context: TestContext,
  alias: ReactAlias,
): Promise<{
  root: string;
  selected: string;
  params: BundleParams;
}> {
  const fixture = await viteFixture(context);
  const extra = path.join(fixture.parent, "extra");
  const selected =
    alias === "same"
      ? path.resolve("node_modules/react")
      : path.join(extra, "node_modules/react");
  if (alias !== "same")
    await fs.cp(path.resolve("node_modules/react"), selected, {
      recursive: true,
    });
  const dependency = path.join(extra, "node_modules/fixture-react-native");
  await fs.mkdir(path.join(dependency, "node_modules"), { recursive: true });
  await fs.writeFile(
    path.join(dependency, "package.json"),
    '{"name":"fixture-react-native","main":"index.cjs"}',
  );
  await fs.writeFile(
    path.join(dependency, "index.cjs"),
    'const React = require("react"); exports.same = value => value === React;',
  );
  await fs.symlink(
    path.resolve("node_modules/react"),
    path.join(dependency, "node_modules/react"),
    "junction",
  );
  const aliases =
    alias === "string"
      ? `[{ find: "react", replacement: ${JSON.stringify(selected)} }]`
      : `[{ find: /^react$/, replacement: ${JSON.stringify(path.join(selected, "index.js"))} }]`;
  await fs.writeFile(
    path.join(fixture.root, "vite.config.ts"),
    `
    import react from "@vitejs/plugin-react";
    export default { resolve: { alias: ${aliases} }, plugins: [react()] };
  `,
  );
  await fs.writeFile(
    path.join(fixture.root, "src/react-alias.mockup.tsx"),
    `
    import React from "react";
    import { createRequire } from "node:module";
    import { defineScreen } from "@mokly/mokly";
    const { same } = createRequire(import.meta.url)(${JSON.stringify(path.join(dependency, "index.cjs"))});
    const expected = createRequire(import.meta.url)(${JSON.stringify(path.join(selected, "index.js"))});
    function Counter() {
      const [value] = React.useState("one runtime");
      return <span>{value}|source={String(React === expected)}|native={String(same(React))}</span>;
    }
    export const screen = defineScreen({ path: "alias", title: "Alias", description: "", relatedDocs: [],
      render: () => <Counter />,
    });
  `,
  );
  return {
    root: fixture.root,
    selected,
    params: {
      ...fixture.params,
      renderer: null,
      entryFiles: ["src/react-alias.mockup.tsx"],
      moduleResolution: {
        ...fixture.params.moduleResolution,
        packageRoots: [extra, path.resolve(".")],
      },
    },
  };
}
