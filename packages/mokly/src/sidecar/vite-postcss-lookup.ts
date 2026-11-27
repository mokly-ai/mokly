import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ResolvedConfig } from "vite";

import type { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import { filename } from "./postcss-read-options.js";
import type { loadVite } from "./vite-peers.js";
import { candidateLocation, setupCandidate } from "./vite-setup-input.js";
import type { SetupInput } from "./vite-setup-input.js";

// These are the search places of the postcss-load-config loader bundled with Vite.
const scripts = ["ts", "cts", "mts", "js", "cjs", "mjs"];
const searchPlaces = [
  "package.json",
  ".postcssrc",
  ...["json", "yaml", "yml", ...scripts].map(
    (suffix) => `.postcssrc.${suffix}`,
  ),
  ...scripts.map((suffix) => `postcss.config.${suffix}`),
];
const active = new AsyncLocalStorage<VitePostcssLookup>();
const require = createRequire(import.meta.url);
let installed = false;

/** Keep the native PostCSS loader inside the side and refresh its config modules. */
export class VitePostcssLookup {
  readonly token = randomUUID();
  readonly modules = new Set<string>();
  readonly candidates = new Set<string>();
  private readonly reported = new Set<string>();
  initial: Promise<SetupInput[]> = Promise.resolve([]);

  constructor(
    private readonly paths: ModulePaths,
    private readonly diagnostic: (line: string) => void,
  ) {}

  configure(
    vite: Awaited<ReturnType<typeof loadVite>>["api"],
    config: ResolvedConfig,
  ): void {
    const postcss = config.css.postcss;
    if (
      config.css.transformer === "lightningcss" ||
      Object.prototype.toString.call(postcss) === "[object Object]"
    )
      return;
    let directory = path.resolve(
      typeof postcss === "string" ? postcss : config.root,
    );
    const stop = path.resolve(vite.searchForWorkspaceRoot(config.root));
    for (;;) {
      for (const place of searchPlaces)
        this.candidates.add(path.join(directory, place));
      const parent = path.dirname(directory);
      if (directory === stop || directory === parent) break;
      directory = parent;
    }
    this.initial = this.snapshot();
  }

  run<T>(run: () => T): T {
    installHooks();
    return active.run(this, run);
  }

  location(file: string): string | undefined {
    try {
      const real = candidateLocation(file);
      if (
        inside(this.paths.sourceRoot, real) ||
        this.paths.dependencyDirectory(real)
      )
        return real;
      if (!this.reported.has(file) && fs.existsSync(file)) {
        this.reported.add(file);
        this.diagnostic(
          `Skipped PostCSS config candidate ${path.basename(file)} outside sourceRoot and selected dependency roots`,
        );
      }
    } catch {
      // An unreadable candidate is unavailable to the PostCSS loader.
    }
  }

  async snapshot(): Promise<SetupInput[]> {
    const inputs: SetupInput[] = [];
    for (const file of this.candidates) {
      const location = this.location(file);
      const name = inside(this.paths.sourceRoot, file)
        ? logical(this.paths.sourceRoot, file)
        : location && this.paths.metadataName(location);
      if (name === undefined) continue;
      try {
        inputs.push(
          location
            ? await setupCandidate(name, location)
            : { name, file: undefined, digest: null },
        );
      } catch {
        inputs.push({ name, file: undefined, digest: null });
      }
    }
    return inputs;
  }
}

function installHooks(): void {
  if (installed) return;
  installed = true;
  const access = fs.promises.access;
  Object.defineProperty(fs.promises, "access", {
    value: async (...args: Parameters<typeof access>) => {
      const lookup = active.getStore();
      if (!lookup) return access(...args);
      const file = filename(args[0]);
      if (!file || !lookup.candidates.has(file)) return access(...args);
      await lookup.initial;
      const location = lookup.location(file);
      if (!location)
        throw Object.assign(
          new Error("PostCSS config candidate is unavailable"),
          { code: "ENOENT" },
        );
      await access(...args);
      lookup.modules.add(location);
    },
  });
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const lookup = active.getStore();
      if (
        lookup &&
        specifier.startsWith("file:") &&
        /\?t=\d+$/.test(specifier)
      ) {
        const url = new URL(specifier);
        const file = fileURLToPath(url);
        if (lookup.modules.has(file)) {
          delete require.cache[file];
          url.searchParams.set("t", lookup.token);
          return nextResolve(url.href, context);
        }
      }
      return nextResolve(specifier, context);
    },
  });
}
