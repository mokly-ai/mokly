import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import { git } from "../helpers/static_changes.js";

import { viteFixture } from "./vite/support.js";

function config(side: string) {
  return `
    import fs from "node:fs";
    import path from "node:path";
    import { createRequire } from "node:module";
    import react from "@vitejs/plugin-react";
    import { defineConfig } from "vite";
    const configured = createRequire(import.meta.url)("@babel/parser").parse("configured").program.body[0].expression.name;
    export default defineConfig({
      plugins: [react()],
      resolve: { alias: { "@fixture/message": path.join(import.meta.dirname, "src/${side}.js") } },
      define: {
        __HAS_MODULES__: JSON.stringify(fs.existsSync(path.join(import.meta.dirname, "node_modules"))),
        __CONFIG_DEP__: JSON.stringify(configured),
      },
    });
  `;
}

function screen(side: string) {
  return `
    import { defineScreen } from "@mokly/mokly";
    import { parse } from "@babel/parser";
    import message from "@fixture/message";
    const dependency = parse("dependency").program.body[0].expression.name;
    export const screen = defineScreen({
      path: "vite", title: "Vite", description: "", relatedDocs: [],
      render: () => <h1>{message}|{import.meta.env.VITE_FIXTURE}|${side}|{dependency}|{__CONFIG_DEP__}|modules={String(__HAS_MODULES__)}</h1>,
    });
  `;
}

export async function viteChangesFixture(context: TestContext): Promise<{
  root: string;
  parent: string;
  params: BundleParams;
  output: string;
  base: string;
}> {
  const fixture = await viteFixture(context);
  await fs.rm(path.join(fixture.root, "src"), { recursive: true });
  await fs.mkdir(path.join(fixture.root, "src"));
  const write = (file: string, text: string) =>
    fs.writeFile(path.join(fixture.root, file), text);
  await write(".gitignore", "node_modules/\n.context/\n");
  await write(
    "mokly.config.json",
    JSON.stringify({
      vite: true,
      roots: [{ dir: "src" }],
      review: { base: "fixture-base" },
    }),
  );
  await write("src/base.js", 'export default "base setup";');
  await write("src/head.js", 'export default "head setup";');
  await write("vite.config.ts", config("base"));
  await write(".env.development", "VITE_FIXTURE=base env\n");
  await write("src/screen.mockup.tsx", screen("base source"));
  for (const args of [
    ["init", "-q"],
    ["config", "user.name", "Mokly Test"],
    ["config", "user.email", "test@example.com"],
    ["add", "."],
    ["commit", "-qm", "base Vite fixture"],
    ["branch", "fixture-base"],
  ])
    await git(fixture.root, ...args);
  const base = await git(fixture.root, "rev-parse", "HEAD");
  await write("vite.config.ts", config("head"));
  await write(".env.development", "VITE_FIXTURE=head env\n");
  await write("src/screen.mockup.tsx", screen("head source"));
  await git(fixture.root, "add", ".");
  await git(fixture.root, "commit", "-qm", "change Vite setup and screen");
  return { ...fixture, base };
}

export function viteSnapshot(
  output: string,
  comparison: string,
  side: "before" | "after",
) {
  return path.join(
    output,
    comparison,
    "snapshots",
    side,
    "mokly-generated/vite/index.mobile.html",
  );
}
