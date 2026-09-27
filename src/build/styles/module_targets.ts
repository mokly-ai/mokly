import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { Targets } from "lightningcss";

import { isInside, toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError, errorMessage } from "../../errors.js";

import { lightningBrowserTargets } from "./lightning.js";

interface BrowserslistQuery {
  (queries?: null, options?: { path?: string }): string[];
}

/** Injected consumer package resolution for isolated target-policy tests. */
export interface BrowserTargetResolver {
  /** Return the consumer's Browserslist query function, if installed. */
  resolve(config: ResolvedConfig): BrowserslistQuery | undefined;
}

/** Fixed fallback for consumers with neither Browserslist nor its configuration. */
export const DEFAULT_MODULE_TARGETS: Targets = {
  chrome: 109 << 16,
  edge: 109 << 16,
  firefox: 115 << 16,
  safari: 14 << 16,
  ios_saf: 14 << 16,
};

/** Resolve CSS Module browser targets from the consumer's package roots. */
export class ConsumerBrowserTargetResolver implements BrowserTargetResolver {
  /** Use the same Node package lookup order as consumer PostCSS plugins. */
  resolve(config: ResolvedConfig): BrowserslistQuery | undefined {
    const requires = [
      createRequire(config.configPath),
      ...config.moduleResolution.packageRoots.map((root) =>
        createRequire(path.join(root, "package.json")),
      ),
    ];
    for (const requirePackage of requires) {
      try {
        const loaded: unknown = requirePackage(
          requirePackage.resolve("browserslist"),
        );
        if (typeof loaded === "function") return loaded as BrowserslistQuery;
      } catch {
        continue;
      }
    }
    return undefined;
  }
}

/** Cache target conversion once per source directory within a graph load. */
export class ModuleBrowserTargets {
  private readonly byDirectory = new Map<string, Targets>();
  private query: BrowserslistQuery | undefined;
  private resolved = false;

  constructor(
    private readonly config: ResolvedConfig,
    private readonly resolver: BrowserTargetResolver = new ConsumerBrowserTargetResolver(),
  ) {}

  /** Return targets for a physical stylesheet, respecting its nearest config. */
  forFile(source: string): Targets {
    const directory = path.dirname(source);
    const cached = this.byDirectory.get(directory);
    if (cached) return cached;
    const relative = toPosixPath(path.relative(this.config.repoRoot, source));
    const configured = hasBrowserslistConfig(directory, this.config.repoRoot);
    if (!configured) {
      this.byDirectory.set(directory, DEFAULT_MODULE_TARGETS);
      return DEFAULT_MODULE_TARGETS;
    }
    if (!this.resolved) {
      this.query = this.resolver.resolve(this.config);
      this.resolved = true;
    }
    if (!this.query)
      throw new MoklyError(
        "build-invalid",
        `Browserslist configuration requires the browserslist package for ${relative}; install browserslist in the consumer repository`,
      );
    const previous = process.env.BROWSERSLIST_IGNORE_OLD_DATA;
    process.env.BROWSERSLIST_IGNORE_OLD_DATA = "1";
    try {
      const targets = lightningBrowserTargets()(
        this.query(null, { path: source }),
      );
      this.byDirectory.set(directory, targets);
      return targets;
    } catch (error) {
      throw new MoklyError(
        "build-invalid",
        `could not resolve CSS Module browser targets in ${relative}: ${errorMessage(error)}; fix the Browserslist configuration`,
        { cause: error },
      );
    } finally {
      if (previous === undefined)
        delete process.env.BROWSERSLIST_IGNORE_OLD_DATA;
      else process.env.BROWSERSLIST_IGNORE_OLD_DATA = previous;
    }
  }
}

function hasBrowserslistConfig(directory: string, repoRoot: string): boolean {
  if (process.env.BROWSERSLIST || process.env.BROWSERSLIST_CONFIG) return true;
  let current = directory;
  while (isInside(repoRoot, current)) {
    if (
      fs.existsSync(path.join(current, ".browserslistrc")) ||
      fs.existsSync(path.join(current, "browserslist"))
    )
      return true;
    try {
      const packageFile = path.join(current, "package.json");
      if (fs.existsSync(packageFile)) {
        const parsed: unknown = JSON.parse(
          fs.readFileSync(packageFile, "utf8"),
        );
        if (parsed && typeof parsed === "object" && "browserslist" in parsed)
          return true;
      }
    } catch {
      return true;
    }
    if (current === repoRoot) break;
    current = path.dirname(current);
  }
  return false;
}
