import fs from "node:fs/promises";
import path from "node:path";

/** One native dependency keeps its own deliberately different React packages. */
export async function nativePeerFixture(
  root: string,
  parent: string,
): Promise<string> {
  const modules = path.join(root, "node_modules");
  await fs.unlink(modules);
  await fs.mkdir(path.join(modules, "@vitejs"), { recursive: true });
  for (const name of [
    "vite",
    "vite-plugin-svgr",
    "react",
    "react-dom",
    "@vitejs/plugin-react",
  ])
    await fs.symlink(
      path.resolve("node_modules", name),
      path.join(modules, name),
      "junction",
    );
  const dependency = path.join(modules, "fixture-node-peers");
  await fs.mkdir(dependency, { recursive: true });
  await fs.writeFile(
    path.join(dependency, "package.json"),
    JSON.stringify({
      name: "fixture-node-peers",
      type: "module",
      exports: "./index.mjs",
    }),
  );
  for (const name of ["react", "react-dom"]) {
    const directory = path.join(dependency, "node_modules", name);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        name,
        version: "0.0.0-nested",
        exports: {
          ".": "./index.cjs",
          "./jsx-runtime": "./jsx.cjs",
          "./jsx-dev-runtime": "./dev.cjs",
          "./client": "./client.cjs",
        },
      }),
    );
    for (const file of ["index", "jsx", "dev", "client"])
      await fs.writeFile(
        path.join(directory, `${file}.cjs`),
        `module.exports={marker:"nested-${name}-${file}"};`,
      );
  }
  await fs.writeFile(
    path.join(dependency, "required.cjs"),
    `
    exports.eager = [require("react"), require("react-dom"), require("react/jsx-runtime")];
    exports.lazy = () => [require("react/jsx-dev-runtime"), require("react-dom/client")];
  `,
  );
  await fs.writeFile(
    path.join(dependency, "index.mjs"),
    `
    import React from "react";
    import DOM from "react-dom";
    import JSX from "react/jsx-runtime";
    import { createRequire } from "node:module";
    import required from "./required.cjs";
    export function inspect(side, outside) {
      const same = (peers, offset) => peers.every((value, index) => value === side[index + offset]);
      return "esm=" + same([React, DOM, JSX], 0) + ";cjs=" + same(required.eager, 0)
        + ";lazy=" + same(required.lazy(), 3)
        + ";scope=" + (createRequire(outside)("react").marker === "outside");
    }
  `,
  );
  const outside = path.join(parent, "unrelated");
  await fs.mkdir(path.join(outside, "node_modules/react"), { recursive: true });
  await fs.writeFile(
    path.join(outside, "node_modules/react/index.js"),
    'module.exports={marker:"outside"};',
  );
  const anchor = path.join(outside, "anchor.cjs");
  await fs.writeFile(
    path.join(root, "src/native.mockup.tsx"),
    `
    import { createRequire } from "node:module";
    import React from "react";
    import DOM from "react-dom";
    import JSX from "react/jsx-runtime";
    import { defineScreen } from "@mokly/mokly";
    import { inspect } from "fixture-node-peers";
    const own = createRequire(import.meta.url);
    const side = [React, DOM, JSX, own("react/jsx-dev-runtime"), own("react-dom/client")];
    export const screen = defineScreen({
      path:"native", title:"Native", description:"", relatedDocs:[],
      render: () => <p>{inspect(side, ${JSON.stringify(anchor)})}</p>,
    });
  `,
  );
  return modules;
}
