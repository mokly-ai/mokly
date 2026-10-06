import { createRequire } from "node:module";

import type { Plugin, Root } from "postcss";

type LocalPluginCreator = (options: { readonly mode: "local" }) => Plugin;
type ImportPluginCreator = () => Plugin;
type ScopePluginCreator = (options: {
  readonly generateScopedName: (name: string) => string;
}) => Plugin;
type ExtractICSS = (root: Root) => {
  readonly icssImports: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
  readonly icssExports: Readonly<Record<string, string>>;
};

/** Lazy runtime plugin functions used only when a CSS Module is imported. */
export interface ModulePlugins {
  readonly localByDefault: LocalPluginCreator;
  readonly extractImports: ImportPluginCreator;
  readonly scope: ScopePluginCreator;
  readonly extractICSS: ExtractICSS;
}

const requireModule = createRequire(import.meta.url);
let cached: ModulePlugins | undefined;

/** Load trusted CSS Modules plugins without evaluating consumer JavaScript. */
export function modulePlugins(): ModulePlugins {
  cached ??= {
    localByDefault: creator<LocalPluginCreator>(
      "postcss-modules-local-by-default",
    ),
    extractImports: creator<ImportPluginCreator>(
      "postcss-modules-extract-imports",
    ),
    scope: creator<ScopePluginCreator>("postcss-modules-scope"),
    extractICSS: extractor(),
  };
  return cached;
}

function creator<Creator extends (...arguments_: never[]) => Plugin>(
  packageName: string,
): Creator {
  const loaded: unknown = requireModule(packageName);
  if (typeof loaded !== "function")
    throw new Error(`${packageName} did not export a plugin creator`);
  return loaded as Creator;
}

function extractor(): ExtractICSS {
  const loaded: unknown = requireModule("icss-utils");
  if (
    !loaded ||
    typeof loaded !== "object" ||
    !("extractICSS" in loaded) ||
    typeof loaded.extractICSS !== "function"
  )
    throw new Error("icss-utils did not export extractICSS");
  return loaded.extractICSS as ExtractICSS;
}
