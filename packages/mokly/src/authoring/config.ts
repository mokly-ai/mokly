import type { ColorScheme } from "./types.js";

type StorybookFolder = string | { config: string };

export type RootConfig = {
  path?: string;
  transparent?: readonly string[];
} & (
  | { dir: string; files?: readonly string[]; storybook?: StorybookFolder }
  | { dir?: never; files?: never; storybook: StorybookFolder }
);
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
  sourcePackages?: Readonly<
    Record<string, false | Readonly<Record<string, string>>>
  >;
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
  review?: { base?: string; baseInstallScripts?: boolean };
  watch?: {
    debounceMs?: number;
    rules?: readonly {
      action: "ignore" | "rebuild" | "reload";
      paths: readonly string[];
    }[];
  };
}
