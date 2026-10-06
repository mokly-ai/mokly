import fs from "node:fs/promises";
import path from "node:path";

import {
  compileCatalogue,
  type Compilation,
} from "../../packages/mokly/dist/build/compile.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";

import { repositoryRoot } from "./fixture.js";

type PathFixtureResult = {
  root: string;
  write: (name: string, content: string) => Promise<void>;
  remove: () => Promise<void>;
  config: () => Promise<ResolvedConfig>;
  compile: () => Promise<Compilation>;
};

/** An isolated consumer of the path-based API, with no legacy test adapters. */
export async function pathFixture(
  files: Readonly<Record<string, string>>,
  config = '{mockupsDir: "generated", roots: [{dir: "specs"}], generatedOutput: "committed"}',
): Promise<PathFixtureResult> {
  const parent = path.join(repositoryRoot, ".context");
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, "paths-"));
  await fs.mkdir(path.join(root, "generated"));
  const write = async (name: string, content: string) => {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  };
  await write("mokly.config.ts", `export default ${config};`);
  for (const [name, content] of Object.entries(files))
    await write(name, content);
  return {
    root,
    write,
    remove: () => fs.rm(root, { recursive: true, force: true }),
    config: () => loadConfig(root),
    compile: async () => compileCatalogue(await loadConfig(root)),
  };
}

/** Source for one page with optional authored path metadata. */
export function pageSource(
  fields = "",
  html = "<html><body>Page</body></html>",
): string {
  return `import {definePage} from '@mokly/mokly'; export default definePage({title:'Page', description:'A complete page', dependencies:[], relatedDocs:[], ${fields} render:()=>${JSON.stringify(html)}});`;
}
