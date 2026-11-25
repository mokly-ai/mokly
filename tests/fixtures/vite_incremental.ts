import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../../packages/mokly/src/generated/sidecar/PageResult.js";
import { installBindings } from "../helpers/sidecar.js";

import { viteFixture, viteFixtureWorker } from "./vite/support.js";

export function incrementalConfig(suffix = ""): string {
  return `
    import fs from "node:fs";
    import path from "node:path";
    import { defineConfig } from "vite";
    import { label } from "./vite-label.ts";
    const root = import.meta.dirname;
    const log = path.join(root, ".context/transforms.jsonl");
    fs.appendFileSync(log, JSON.stringify({ setup: label }) + "\\n");
    export default defineConfig({
      define: { __VITE_SETUP__: JSON.stringify(label + ${JSON.stringify(suffix)}) },
      plugins: [{
        name: "fixture-transform-record",
        transform(code, id) {
          if (id.startsWith(path.join(root, "src")))
            fs.appendFileSync(log, JSON.stringify({ module: path.relative(root, id) }) + "\\n");
        },
      }],
    });
  `;
}

interface IncrementalFixture {
  root: string;
  parent: string;
  output: string;
  params: BundleParams;
  write(file: string, text: string): Promise<void>;
  compile(): Promise<BundleResult>;
  replaceWorker(): Promise<void>;
  render(bundle: BundleResult): Promise<PageResult>;
  transforms(): Promise<string[]>;
  setups(): Promise<string[]>;
  clear(): Promise<void>;
  sidecar: Awaited<ReturnType<typeof viteFixtureWorker>>["sidecar"];
}

export async function incrementalFixture(
  context: TestContext,
): Promise<IncrementalFixture> {
  const fixture = await viteFixture(context);
  const write = (file: string, text: string) =>
    fs.writeFile(path.join(fixture.root, file), text);
  await fs.mkdir(path.join(fixture.root, ".context"));
  await write("vite.config.ts", incrementalConfig());
  await write("vite-label.ts", 'export const label = "setup";');
  await write(".env.development", "VITE_LIVE=env-before\n");
  await write("src/live-message.ts", 'export const message = "before";');
  await write("src/live-stable.ts", 'export const stable = "stable";');
  await write(
    "src/live.mockup.ts",
    `
      import { definePage } from "@mokly/mokly";
      import { message } from "./live-message";
      import raw from "./live-message.ts?raw";
      import { stable } from "./live-stable.ts";
      export const page = definePage({
        path: "live", title: "Live", description: "", relatedDocs: [],
        render: () => "<!doctype html><html><head></head><body>" +
          [message, raw, stable, __VITE_SETUP__, import.meta.env.VITE_LIVE].join("|") +
          "</body></html>",
      });
    `,
  );
  const worker = await viteFixtureWorker(context, fixture.root);
  const params = {
    ...fixture.params,
    entryFiles: ["src/live.mockup.ts"],
    renderer: null,
    capture: "serveEdit",
  };
  const compile = () => worker.sidecar.call<BundleResult>("bundle", params);
  const render = async (bundle: BundleResult) => {
    const { sidecar } = worker;
    await installBindings(sidecar, bundle.generation);
    return sidecar.call<PageResult>("renderPage", {
      generation: bundle.generation,
      handle: "src/live.mockup.ts#page",
    });
  };
  const log = path.join(fixture.root, ".context/transforms.jsonl");
  const records = async () => {
    const lines = (await fs.readFile(log, "utf8")).trim().split("\n");
    return lines.filter(Boolean).map((line) => {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== "object")
        throw new Error("invalid transform record");
      return {
        module:
          "module" in value && typeof value.module === "string"
            ? value.module
            : undefined,
        setup:
          "setup" in value && typeof value.setup === "string"
            ? value.setup
            : undefined,
      };
    });
  };
  const transforms = async () =>
    (await records()).flatMap((record) => record.module ?? []).sort();
  const setups = async () =>
    (await records()).flatMap((record) => record.setup ?? []);
  const clear = () => fs.writeFile(log, "");
  return {
    ...fixture,
    write,
    compile,
    render,
    transforms,
    setups,
    clear,
    get sidecar() {
      return worker.sidecar;
    },
    replaceWorker: worker.replaceWorker,
  };
}
