import type { TestContext } from "node:test";

import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../../packages/mokly/src/generated/sidecar/RenderResult.js";
import { viteFixture } from "../fixtures/vite/support.js";

import { installBindings, startSidecar } from "./sidecar.js";
import { write } from "./static_changes.js";

export async function storyUseFixture(
  context: TestContext,
  files: Record<string, string>,
) {
  const { root, params } = await viteFixture(context);
  await Promise.all(
    Object.entries(files).map(([file, source]) => write(root, file, source)),
  );
  const storyFiles = Object.keys(files).filter((file) =>
    file.endsWith(".stories.tsx"),
  );
  const handle = "screen.mockup.tsx#default";
  const start = async () => {
    const sidecar = startSidecar(context, root, {
      ...process.env,
      NODE_ENV: undefined,
    });
    await sidecar.call("hello");
    return sidecar;
  };
  const render = async (
    sidecar: Awaited<ReturnType<typeof start>>,
    generation: string,
  ) => {
    await sidecar.call("cssModules", { generation, classMaps: {} });
    const bindings = await installBindings(sidecar, generation);
    const axes = { generation, viewport: "mobile", colorScheme: "light" };
    return {
      screen: (props: Record<string, unknown> = {}) =>
        sidecar.call<RenderResult>("renderScreen", {
          ...axes,
          handle,
          entry: bindings[handle],
          props,
        }),
      story: (storyId: string, props: Record<string, unknown> = {}) =>
        sidecar.call("renderStory", { ...axes, storyId, props }),
    };
  };
  return {
    async compile(vite: boolean, stories = true) {
      const sidecar = await start();
      const settings = {
        ...params,
        vite,
        renderer: null,
        entryFiles: ["screen.mockup.tsx"],
        storiesFiles: stories ? storyFiles : [],
      };
      const bundle = await sidecar.call<BundleResult>("bundle", settings);
      const { generation } = bundle;
      return {
        ...(await render(sidecar, generation)),
        async restore() {
          const restored = await start();
          await restored.call("restoreGeneration", {
            ...bundle,
            params: settings,
          });
          return render(restored, generation);
        },
      };
    },
  };
}

export function storyMetas(from: string, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => [
      `${name}.stories.tsx`,
      `import { ${name} } from "${from}";
       export default { title: "${name}", component: ${name} };
       export const Primary = { render: () => <${name} /> };`,
    ]),
  );
}

export function withoutUsageMarkers(html: string) {
  return html.replace(
    /<!--mokly-(?:instance|slot):(?:start|end) [\s\S]*?-->/gu,
    "",
  );
}
