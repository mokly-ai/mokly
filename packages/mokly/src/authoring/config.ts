import type { ColorScheme } from "./types.js";

export interface RootConfig {
  dir: string;
  files?: readonly string[];
  path?: string;
  transparent?: readonly string[];
}
export type ModuleLoader =
  | "js"
  | "jsx"
  | "ts"
  | "tsx"
  | "json"
  | "text"
  | "base64"
  | "dataurl"
  | "binary"
  | "empty"
  | "file";
export interface ModuleResolution {
  aliases?: Readonly<Record<string, string>>;
  conditions?: readonly string[];
  loaders?: Readonly<Record<string, ModuleLoader>>;
  mainFields?: readonly string[];
  packageRoots?: readonly string[];
  resolveExtensions?: readonly string[];
}
export interface MoklyConfig {
  colorSchemes?: readonly ColorScheme[];
  roots?: readonly RootConfig[];
  repoRoot?: string;
  renderer?: string;
  postcss?: string;
  moduleResolution?: ModuleResolution;
  stylesheets?: readonly {
    match: string;
    stylesheets: readonly string[];
    lightStylesheets?: readonly string[];
    darkStylesheets?: readonly string[];
  }[];
  review?: { base?: string };
  watch?: {
    debounceMs?: number;
    rules?: readonly {
      action: "ignore" | "rebuild" | "reload";
      paths: readonly string[];
    }[];
  };
}
