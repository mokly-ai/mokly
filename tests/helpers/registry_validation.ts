import path from "node:path";

import { DEFAULT_PUBLIC_EXCLUDE } from "../../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../../dist/config/types.js";

import { repositoryRoot } from "./fixture.js";

/** A complete registry-only configuration for source-adjacent authoring tests. */
export function registryValidationConfig(sourcePath: string): ResolvedConfig {
  return {
    generatedOutput: "committed",
    publicExclude: DEFAULT_PUBLIC_EXCLUDE,
    colorSchemes: ["light"],
    compatibility: {},
    configPath: path.join(repositoryRoot, "mokly.config.ts"),
    entriesDir: path.join(repositoryRoot, "tests"),
    entryGlobs: ["tests/**/*.mockup.{ts,tsx}"],
    interactive: "off",
    mockupsDir: path.join(repositoryRoot, "mockups"),
    moduleResolution: { aliases: {}, loaders: {}, packageRoots: [] },
    repoRoot: repositoryRoot,
    review: { base: "main", outDir: ".review", sharedImpact: [] },
    sourceFiles: [sourcePath],
    stylesheets: [],
    watch: { debounceMs: 100, rules: [] },
  };
}
