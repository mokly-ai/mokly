import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";

import { bundleParams } from "./sidecar.js";

interface StyleFixture {
  root: string;
  write(file: string, text: string): Promise<void>;
  params(entry: string): BundleParams;
}

export async function styleFixture(
  context: TestContext,
): Promise<StyleFixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-style-wrapper-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (file: string, text: string) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  };
  for (const name of ["nested.mockup.mjs", "emotion.mockup.tsx"])
    await write(
      `apps/web/${name}`,
      await fs.readFile(`tests/fixtures/style-subpaths/${name}`, "utf8"),
    );
  await write(
    "apps/web/node_modules/react-native-web/package.json",
    JSON.stringify({ name: "react-native-web", main: "index.cjs" }),
  );
  await write(
    "apps/web/node_modules/react-native-web/index.cjs",
    'exports.registry = "nested";',
  );
  await write(
    "apps/web/node_modules/react-native-web/subpath.js",
    'exports.label = "Nested library";',
  );
  await write(
    "apps/web/node_modules/@emotion/react/package.json",
    JSON.stringify({ name: "@emotion/react", main: "index.cjs" }),
  );
  await write(
    "apps/web/node_modules/@emotion/react/index.cjs",
    'exports.registry = "nested emotion";',
  );
  await write(
    "apps/web/node_modules/@emotion/react/jsx-dev-runtime.js",
    "exports.jsxDEV = (type, props) => ({type, props});",
  );
  const params = (entry: string) =>
    bundleParams({
      sourceRoot: root,
      configurationDirectory: "apps/web",
      entryFiles: [`apps/web/${entry}`],
      renderer: null,
      storiesFiles: [],
      moduleResolution: {
        ...bundleParams().moduleResolution,
        packageRoots: [],
      },
    });
  return { root, write, params };
}
