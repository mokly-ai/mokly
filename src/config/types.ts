import type { ColorScheme } from "@mokly/viewer";

import type { FolderRecord } from "../registry/folder_records.js";

/** Filesystem changes understood by the watched development runtime. */
export type WatchAction = "ignore" | "rebuild" | "reload" | "restart";

/** One glob-to-stylesheet mapping evaluated in declaration order. */
export interface StylesheetRule {
  /** POSIX glob matched against a screen route. */
  match: string;
  /** Paths relative to `mockupsDir`, or absolute HTTP(S) URLs. */
  stylesheets: readonly string[];
  /** Additional stylesheets appended for light fragments. */
  lightStylesheets?: readonly string[];
  /** Additional stylesheets appended for dark fragments. */
  darkStylesheets?: readonly string[];
}

/** One additional consumer watch input. */
export interface WatchRule {
  action: WatchAction;
  /** Repository-relative POSIX globs. */
  paths: readonly string[];
}

/** Watched-development behavior. */
export interface WatchConfig {
  /** Debounce window applied to a burst of filesystem notifications. */
  debounceMs?: number;
  /** Additional classified consumer inputs. */
  rules?: readonly WatchRule[];
}

/** Git comparison and artifact configuration. */
export interface ReviewConfig {
  /** Shell-free commands run using trusted historical code for missing baselines. */
  baselineBuild?: readonly (readonly string[])[];
  /** Git ref whose merge base with HEAD is the comparison branch point. */
  base?: string;
  /** Config-relative artifact directory. */
  outDir?: string;
  /** Repository-relative POSIX globs whose changes can affect many screens. */
  sharedImpact?: readonly string[];
}

/** Esbuild loaders allowed for consumer-authored module extensions. */
export type ModuleLoader =
  | "base64"
  | "binary"
  | "css"
  | "dataurl"
  | "empty"
  | "file"
  | "js"
  | "json"
  | "jsx"
  | "text"
  | "ts"
  | "tsx";

/** Consumer-owned module resolution needed by cross-platform component trees. */
export interface ModuleResolutionConfig {
  /** Bare module aliases applied while bundling entries and renderers. */
  aliases?: Readonly<Record<string, string>>;
  /** Export conditions evaluated in declaration order. */
  conditions?: readonly string[];
  /** Extension-to-loader overrides for consumer modules. */
  loaders?: Readonly<Record<string, ModuleLoader>>;
  /** Package fields evaluated in declaration order. */
  mainFields?: readonly string[];
  /** Config-relative package roots whose node_modules directories are searched. */
  packageRoots?: readonly string[];
  /** Module extensions evaluated in declaration order. */
  resolveExtensions?: readonly string[];
}

/** Public, serializable host configuration. */
export interface MoklyConfig {
  /** Color schemes rendered for screens; defaults to light only. */
  colorSchemes?: readonly ColorScheme[];
  /** Directories scanned for definitions; defaults to specs. */
  roots?: readonly RootConfig[];
  /** Config-relative authored catalogue directory. */
  mockupsDir: string;
  /** Config-relative repository root; defaults to the config directory. */
  repoRoot?: string;
  /** Optional config-relative consumer renderer module. */
  renderer?: string;
  /** Optional config-relative PostCSS configuration module. */
  postcss?: string;
  /** Optional consumer-specific module resolution for cross-platform sources. */
  moduleResolution?: ModuleResolutionConfig;
  /** Ordered route-to-stylesheet mappings. */
  stylesheets?: readonly StylesheetRule[];
  /** Review settings. */
  review?: ReviewConfig;
  /** Watch settings. */
  watch?: WatchConfig;
}

/** Absolute, validated configuration consumed by runtime engines. */
export interface ResolvedConfig {
  colorSchemes: readonly ColorScheme[];
  configPath: string;
  /** Complete authoring inventory retained across compile and serving boundaries. */
  sourceFiles?: readonly string[];
  /** Inputs to the separately bundled configuration graph. */
  configSourceFiles?: readonly string[];
  /** Validated roots in authored order. */
  roots: readonly ResolvedRoot[];
  /** Sorted absolute files retained by discovery, including Markdown documents. */
  resolvedFiles?: readonly string[];
  /** Root-glob matches, including files excluded from entry discovery. */
  protectedFiles?: readonly string[];
  /** Exact root ownership from the same discovery pass, keyed by repo-relative file. */
  rootByFile?: Readonly<Record<string, number>>;
  /** Sorted absolute executable entry modules. */
  entryModules?: readonly string[];
  /** Directory records retained by the same discovery pass. */
  folderRecords?: readonly FolderRecord[];
  mockupsDir: string;
  /** Mokly-owned generated output, always inside the catalogue directory. */
  generatedDir: string;
  moduleResolution: ResolvedModuleResolutionConfig;
  renderer?: string;
  /** Absolute PostCSS module path; plugin instances never cross IPC. */
  postcss?: string;
  /** Globbed PostCSS directory dependencies from the accepted graph. */
  postcssWatchDirectories?: readonly {
    readonly directory: string;
    readonly glob: string;
  }[];
  repoRoot: string;
  review: Required<Omit<ReviewConfig, "baselineBuild">> &
    Pick<ReviewConfig, "baselineBuild">;
  stylesheets: readonly StylesheetRule[];
  watch: Required<Pick<WatchConfig, "debounceMs">> & {
    rules: readonly WatchRule[];
  };
}

/** Validated module resolution with absolute package roots. */
export interface ResolvedModuleResolutionConfig {
  aliases: Readonly<Record<string, string>>;
  conditions?: readonly string[];
  loaders: Readonly<Record<string, ModuleLoader>>;
  mainFields?: readonly string[];
  packageRoots: readonly string[];
  resolveExtensions?: readonly string[];
}

/** One config-relative source tree and its path derivation rules. */
export interface RootConfig {
  dir: string;
  files?: readonly string[];
  path?: string;
  transparent?: readonly string[];
}
/** One root with absolute directory and resolved defaults. */
export interface ResolvedRoot {
  dir: string;
  files: readonly string[];
  path?: string;
  transparent: readonly string[];
}
