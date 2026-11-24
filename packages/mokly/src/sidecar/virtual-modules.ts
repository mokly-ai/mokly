import fs from "node:fs/promises";
import path from "node:path";

import { cssModulePrefix } from "./css-modules.js";
import type { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";

/** Build the facade key from a repository-owned importer outside this package. */
export async function authoringModulePath(
  root: string,
  importerPath: string,
  paths: ModulePaths,
): Promise<string> {
  const ownPackage = path.resolve(import.meta.dirname, "../..");
  const importer =
    importerPath && (await fs.realpath(importerPath).catch(() => importerPath));
  const attributed =
    importer &&
    paths.repositoryOwned(importer) &&
    !inside(ownPackage, importer);
  return JSON.stringify(attributed ? logical(root, importer) : null);
}

/** Build the authoring facade with a caller-selected runtime expression. */
export function authoringModuleSource(
  sourcePath: string,
  runtimeExpression = 'require("mokly:runtime")',
): string {
  return `const api = ${runtimeExpression}.authoring(${sourcePath === "null" ? "undefined" : sourcePath});
        export const {defineScreen,defineComponent,definePage,defineUseCase,defineFolder,
          MockLink,mockLink,ReviewIgnore,ReviewIgnoreScope,reviewMaterialKey} = api;`;
}

/** Allow reserved runtime imports only from their owning virtual modules. */
export function runtimeImportAllowed(
  specifier: string,
  namespace: string,
): boolean {
  return specifier.startsWith(cssModulePrefix)
    ? namespace === "mokly-css"
    : specifier === "mokly:runtime" &&
        ["mokly-authoring", "mokly-css", "mokly-style"].includes(namespace);
}

/** Build the JSX shim with call-site paths resolved from the configuration. */
export function jsxDevelopmentModuleSource(
  root: string,
  configurationDirectory: string,
): string {
  return `import { jsx, jsxs, Fragment } from "react/jsx-runtime";
        import { resolve } from "node:path";
        export { Fragment };
        export function jsxDEV(type, props, key, staticChildren, source) {
          if (type && type[Symbol.for("mokly.component")] && source)
            props = {...props, __moklySource: {...source, fileName: resolve(${JSON.stringify(path.resolve(root, configurationDirectory))}, source.fileName)}};
          return (staticChildren ? jsxs : jsx)(type, props, key);
        }`;
}

/** Build the CSS Modules stub with caller-selected runtime and class imports. */
export function cssModuleSource(
  file: string,
  runtimeExpression = 'require("mokly:runtime")',
  classesModule = cssModulePrefix + file,
): string {
  return `export default ${runtimeExpression}.css(${JSON.stringify(file)});\nexport * from ${JSON.stringify(classesModule)};`;
}
