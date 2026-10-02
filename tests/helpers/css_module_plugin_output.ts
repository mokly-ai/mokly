import postcss from "postcss";

import { modulePlugins } from "../../dist/build/styles/module_plugins.js";
import { prepareModuleScopes } from "../../dist/build/styles/module_scope.js";

/** Run the four CSS Modules plugin calls without using Mokly's scopeModule. */
export function pluginModuleOutput(
  css: string,
  relative: string,
  prefix: string,
): {
  readonly css: string;
  readonly exports: Readonly<Record<string, string>>;
} {
  const root = postcss.parse(css, { from: relative });
  const restore = prepareModuleScopes(root, relative);
  const plugins = modulePlugins();
  const result = postcss([
    plugins.localByDefault({ mode: "local" }),
    plugins.extractImports(),
    plugins.scope({ generateScopedName: (name) => `${prefix}${name}` }),
  ])
    .process(root, { from: relative, map: false })
    .sync();
  const { icssExports } = plugins.extractICSS(result.root);
  restore();
  return {
    css: result.root.toString(),
    exports: Object.fromEntries(
      Object.keys(icssExports)
        .sort()
        .map((name) => [name, icssExports[name]!]),
    ),
  };
}
