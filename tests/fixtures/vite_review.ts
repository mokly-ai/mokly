import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../../packages/mokly/src/generated/sidecar/PageResult.js";
import { installBindings } from "../helpers/sidecar.js";

import { viteFixture, viteFixtureWorker } from "./vite/support.js";

export interface ReviewFixture {
  root: string;
  parent: string;
  output: string;
  params: BundleParams;
  sidecar: Awaited<ReturnType<typeof viteFixtureWorker>>["sidecar"];
  replaceWorker(): Promise<void>;
  write(file: string, text: string): Promise<void>;
  compile(): Promise<BundleResult>;
  render(bundle: BundleResult, file?: string): Promise<PageResult>;
}

export async function reviewFixture(
  context: TestContext,
  side: "head" | "base" = "head",
): Promise<ReviewFixture> {
  const fixture = await viteFixture(context);
  let root = fixture.root;
  if (side === "base") {
    root = path.join(fixture.parent, "extraction");
    await fs.cp(fixture.root, root, {
      recursive: true,
      filter: (file) => path.basename(file) !== "node_modules",
    });
  }
  await fs.rm(path.join(root, "vite.config.ts"));
  const write = async (file: string, text: string) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  };
  const params = {
    ...fixture.params,
    sourceRoot: root,
    renderer: null,
    entryFiles: ["src/review.mockup.ts"],
    repositoryRoots: [fixture.root],
    moduleResolution: {
      ...fixture.params.moduleResolution,
      ...(side === "base" ? { dependencyRoot: fixture.root } : {}),
    },
  };
  const worker = await viteFixtureWorker(context, root);
  const compile = () => worker.sidecar.call<BundleResult>("bundle", params);
  const render = async (bundle: BundleResult, file = params.entryFiles[0]!) => {
    const { sidecar } = worker;
    await installBindings(sidecar, bundle.generation);
    return sidecar.call<PageResult>("renderPage", {
      generation: bundle.generation,
      handle: `${file}#page`,
    });
  };
  return {
    ...fixture,
    root,
    params,
    get sidecar() {
      return worker.sidecar;
    },
    replaceWorker: worker.replaceWorker,
    write,
    compile,
    render,
  };
}

export function reviewPage(expression: string, imports = ""): string {
  return `
    import { definePage } from "@mokly/mokly";
    ${imports}
    export const page = definePage({ title: "Review", description: "", relatedDocs: [],
      render: () => "<html><head></head><body>" + (${expression}) + "</body></html>",
    });
  `;
}
