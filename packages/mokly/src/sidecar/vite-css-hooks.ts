import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

import type { Plugin, ResolvedConfig } from "vite";

import { viteCssModule } from "./vite-css-paths.js";
import type { ViteCssTransform } from "./vite-css-transform.js";
import type { ViteLookup } from "./vite-resolution.js";
import { viteFile } from "./vite-urls.js";

type Transform = Exclude<
  NonNullable<Plugin["transform"]>,
  { handler: unknown }
>;

export function configureViteCss(
  config: ResolvedConfig,
  lookup: ViteLookup,
  css: ViteCssTransform,
): void {
  const modules = config.css.modules;
  if (modules !== false) {
    config.css.modules = {
      ...modules,
      generateScopedName(name, file) {
        const logical = lookup.paths.name(viteFile(file) ?? file);
        const hash = createHash("sha256").update(logical).digest("hex");
        return `mokly_${hash.slice(0, 12)}_${name}`;
      },
    };
  }
  if (config.css.transformer === "lightningcss") {
    const options = config.css.lightningcss;
    const modules = options?.cssModules;
    config.css.lightningcss = {
      ...options,
      cssModules:
        modules === false
          ? false
          : {
              ...(typeof modules === "object" ? modules : {}),
              pattern: "mokly_[hash]_[local]",
            },
    };
  }
  const createResolver = config.createResolver.bind(config);
  const resolver: ResolvedConfig["createResolver"] = (options) => {
    const original = createResolver(options);
    if (!options?.preferRelative) return original;
    if (options.tryIndex === false && options.extensions?.length === 0)
      return (source, importer, aliasOnly, ssr) =>
        css.active
          ? Promise.resolve(css.active.urls.resolve(source, importer))
          : original(source, importer, aliasOnly, ssr);
    if (!options.mainFields?.includes("style")) return original;
    return async (source, importer, aliasOnly, ssr) => {
      if (!css.active || aliasOnly)
        return original(source, importer, aliasOnly, ssr);
      const file = source.startsWith("file:") ? fileURLToPath(source) : source;
      const resolved = await lookup.stylesheet(file, importer, (target, from) =>
        original(target, from, aliasOnly, ssr),
      );
      if (resolved) await css.active.read(resolved);
      return resolved;
    };
  };
  Object.assign(config, { createResolver: resolver });
}

/** Share the native CSS module cache between inline CSS and its JS exports. */
export function hookViteCss(plugins: Plugin[], css: ViteCssTransform): void {
  hook(
    plugins,
    "vite:css",
    (transform) =>
      async function (code, id, options) {
        const active = css.forId(id);
        if (!active) return transform.call(this, code, id, options);
        const watch = this.addWatchFile;
        const logger = this.environment.logger;
        const warn = logger.warn;
        let droppedImport: string | undefined;
        logger.warn = (message, options) => {
          const warning = droppedImportWarning(message);
          if (warning) droppedImport ??= warning;
          else warn.call(logger, message, options);
        };
        this.addWatchFile = (file) => {
          if (!active.urls.owns(file)) watch.call(this, file);
        };
        try {
          const cacheId = viteCssModule(active.file) ? active.file : id;
          const result = await active.urls.preserve(() =>
            Promise.resolve(transform.call(this, code, cacheId, options)),
          );
          if (droppedImport) this.error(droppedImport);
          if (typeof result === "string") return active.urls.restore(result);
          if (result?.code !== undefined)
            return {
              ...result,
              code: active.urls.restore(result.code.toString()),
            };
          return result;
        } finally {
          logger.warn = warn;
          this.addWatchFile = watch;
        }
      },
  );
  hook(
    plugins,
    "vite:css-post",
    (transform) =>
      async function (code, id, options) {
        const active = css.forId(id);
        if (active && viteCssModule(active.file)) {
          const result = await transform.call(this, code, active.file, options);
          const exports = typeof result === "string" ? result : result?.code;
          if (exports)
            active.classMap = await nativeClassMap(exports.toString());
        }
        return transform.call(this, code, id, options);
      },
  );
}

function droppedImportWarning(message: string): string | undefined {
  const line = stripVTControlCharacters(message).split("\n", 1)[0];
  const prefix = "[vite:css][postcss] ";
  if (
    line?.startsWith(
      `${prefix}@import statements must precede all other statements`,
    )
  )
    return line.slice(prefix.length);
}

function hook(
  plugins: Plugin[],
  name: string,
  wrap: (transform: Transform) => Transform,
): void {
  const plugin = plugins.find((plugin) => plugin.name === name);
  const transform = plugin?.transform;
  if (!plugin || !transform) return;
  plugin.transform =
    typeof transform === "function"
      ? wrap(transform)
      : { ...transform, handler: wrap(transform.handler) };
}

async function nativeClassMap(code: string): Promise<Record<string, string>> {
  const module: { default?: unknown } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
  const map = module.default;
  return map && typeof map === "object"
    ? Object.fromEntries(
        Object.entries(map).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};
}
