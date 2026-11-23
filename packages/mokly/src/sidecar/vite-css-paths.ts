import { randomBytes } from "node:crypto";
import path from "node:path";

import type { ResolvedConfig } from "vite";

import type { ModulePaths } from "./module-paths.js";
import { viteFile } from "./vite-urls.js";

const stylesheet = /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)$/;

export function viteStylesheet(file: string): boolean {
  return stylesheet.test(file);
}

export function viteCssModule(file: string): boolean {
  return viteStylesheet(file) && /\.module\.[^.]+$/.test(file);
}

export function viteCssEnabled(
  loaders: Record<string, string | undefined>,
  file: string,
): boolean {
  return (
    loaders[".css"] !== "empty" &&
    (!viteCssModule(file) || loaders[".module.css"] !== "empty")
  );
}

export function viteInlineCssId(file: string): string {
  return `${file.split(path.sep).join("/")}?inline`;
}

/** Rebase nested assets without handing them to Vite's asset loader. */
export class ViteCssUrls {
  private readonly prefix = `mokly-css-${randomBytes(12).toString("hex")}`;
  private readonly origin = `https://${this.prefix}.invalid`;
  private readonly replacements: string[] = [];

  constructor(
    private readonly config: ResolvedConfig,
    private readonly paths: ModulePaths,
    private readonly stylesheet: string,
  ) {}

  async preserve<T>(run: () => Promise<T>): Promise<T> {
    const origin = this.config.server.origin;
    this.config.server.origin = this.origin;
    try {
      return await run();
    } finally {
      if (origin === undefined) delete this.config.server.origin;
      else this.config.server.origin = origin;
    }
  }

  resolve(url: string, importer?: string): string | undefined {
    const file = importer && viteFile(importer);
    if (!file || /^(?:\/|[a-z][\w+.-]*:)/i.test(url)) return;
    const from = path.posix.dirname(this.paths.name(file));
    const to = path.posix.dirname(this.stylesheet);
    const prefix = path.posix.relative(to, from);
    if (!prefix) return;
    const index = this.replacements.push(`${prefix}/${encodeURI(url)}`) - 1;
    return `${this.config.root}/${this.prefix}/${index}`;
  }

  owns(file: string): boolean {
    return file.startsWith(`${this.config.root}/${this.prefix}/`);
  }

  restore(css: string): string {
    const browserBase = `${this.origin}${decodeURI(this.config.base)}`;
    const prefix = `${browserBase}${this.prefix}/`;
    return css
      .replaceAll(
        new RegExp(`${escapeRegExp(prefix)}(\\d+)`, "g"),
        (_, index: string) => this.replacements[Number(index)] ?? "",
      )
      .replaceAll(browserBase, "/");
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
