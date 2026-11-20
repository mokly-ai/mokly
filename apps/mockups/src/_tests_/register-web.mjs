/**
 * The policy runner preloads this hook so dependencies, not only the
 * catalogue's own sources, resolve through the one web boundary:
 * `react-native` and `react-native-web` both point at the one installed web
 * runtime, and a `.web.*` sibling wins for a relative import. Mokly compiles
 * the stylesheets, and the policy tests need only an import's side effect, so
 * `@mokly/ui/styles.css`, the package stylesheet that the viewer drawings
 * import, and each relative `.css` import of a mockup source load as empty
 * modules. The tsconfig paths cover the public script entries that the
 * catalogue imports; they do not reach inside dependencies or name a
 * stylesheet, and Node finds no package from `docs/mockups`, which is why
 * this hook exists. It first removes every inherited `GIT_*` variable.
 */
import "./clear-git-environment.mjs";

import { existsSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { URL } from "node:url";

const webRuntime = createRequire(import.meta.url).resolve("react-native-web");
const packageStylesheets = new Map(
  ["@mokly/ui/styles.css"].map((specifier) => [
    specifier,
    import.meta.resolve(specifier),
  ]),
);
const mockupSources = new URL("../../../../docs/mockups/src/", import.meta.url)
  .href;
const emptyStylesheets = new Set(packageStylesheets.values());

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stylesheet = packageStylesheets.get(specifier);
    if (stylesheet) return { shortCircuit: true, url: stylesheet };
    const parent = context.parentURL;
    if (specifier.startsWith(".") && parent?.startsWith("file:")) {
      if (specifier.endsWith(".css") && parent.startsWith(mockupSources)) {
        const resolved = nextResolve(specifier, context);
        emptyStylesheets.add(resolved.url);
        return resolved;
      }
      const stem = specifier.replace(/\.(?:jsx?|tsx?)$/, "");
      for (const extension of [".web.tsx", ".web.ts", ".web.js"]) {
        const candidate = new URL(stem + extension, parent);
        if (existsSync(candidate)) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(
      specifier === "react-native" || specifier === "react-native-web"
        ? webRuntime
        : specifier,
      context,
    );
  },
  load(url, context, nextLoad) {
    if (emptyStylesheets.has(url))
      return { format: "module", shortCircuit: true, source: "" };
    return nextLoad(url, context);
  },
});
