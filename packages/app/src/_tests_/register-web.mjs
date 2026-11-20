import { existsSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { URL } from "node:url";

const webRuntime = createRequire(import.meta.url).resolve("react-native-web");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const stem = specifier.replace(/\.(?:jsx?|tsx?)$/, "");
      for (const extension of [".web.tsx", ".web.ts", ".web.js"]) {
        const candidate = new URL(stem + extension, context.parentURL);
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
});
