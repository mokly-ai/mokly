import fs from "node:fs/promises";
import { findPackageJSON } from "node:module";
import path from "node:path";
import type { TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import {
  link,
  nativeParams,
  nativeRoot,
  write,
} from "../helpers/native_resolution.js";

const installed = path.resolve("node_modules");
const ui = "packages/ui";
const folder = `${ui}/.storybook`;
export const main = `${folder}/main.ts`;
export const module = `${folder}/framework.ts`;
export const selection = `${folder}/selection.txt`;
export const file = `${ui}/story.stories.tsx`;

interface FrameworkProject {
  root: string;
  params: BundleParams;
  folder: string;
  uiLibraries: string;
}

export async function frameworkProject(
  context: TestContext,
  vite = false,
): Promise<FrameworkProject> {
  const root = await nativeRoot(context);
  const libraries = path.join(root, "node_modules");
  const uiLibraries = path.join(root, ui, "node_modules");
  await Promise.all([
    install("react", libraries),
    install("react-dom", libraries),
    install("storybook", uiLibraries),
    ...(vite ? [install("vite", libraries)] : []),
  ]);
  for (const name of ["fixture-framework", "other-framework"]) {
    const framework = path.join(uiLibraries, name);
    await write(
      path.join(framework, "package.json"),
      JSON.stringify({
        name,
        main: "index.cjs",
        dependencies: { "@storybook/react": "10.6.2" },
      }),
    );
    await write(
      path.join(framework, "index.cjs"),
      'throw new Error("the portable renderer must not run the framework entry");',
    );
    await install("@storybook/react", path.join(framework, "node_modules"));
  }
  await write(path.join(root, "package.json"), '{"type":"module"}');
  await fs.mkdir(path.join(root, "tools"));
  await write(
    path.join(root, file),
    `export default { render: (_args, {globals}) => <output>{globals.label}</output> }; export const Primary = {};`,
  );
  await write(
    path.join(root, folder, "preview.ts"),
    'export default { initialGlobals: { label: "framework preview" } };',
  );
  await write(
    path.join(root, main),
    'import framework from "./framework.js"; export default { framework };',
  );
  await write(
    path.join(root, module),
    `
import { readFileSync } from "node:fs";
const name: string = readFileSync(new URL("./selection.txt", import.meta.url), "utf8").trim();
export default name === "fixture-framework" ? { name } : name;
`,
  );
  await write(path.join(root, selection), "fixture-framework");
  return {
    root,
    params: nativeParams(root, {
      vite,
      configurationDirectory: "tools",
      entryFiles: [],
      storiesFiles: [file],
      storybookFolders: { [file]: folder },
    }),
    folder,
    uiLibraries,
  };
}

/** Keep the installed package real and point its other dependencies at the workspace. */
async function install(name: string, directory: string) {
  const source = path.join(installed, name);
  await fs.cp(source, path.join(directory, name), { recursive: true });
  const manifest = path.join(source, "package.json");
  const json = JSON.parse(await fs.readFile(manifest, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  for (const dependency of Object.keys(json.dependencies ?? {})) {
    const peer = findPackageJSON(dependency, pathToFileURL(manifest));
    if (peer) await link(path.dirname(peer), path.join(directory, dependency));
  }
}
