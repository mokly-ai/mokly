import fs from "node:fs";
import path from "node:path";

import postcss from "postcss";

import { toPosixPath } from "../../config/paths.js";
import type { NormalizedPostcssPlugin } from "../../config/postcss_loader.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError, errorMessage } from "../../errors.js";

import type { ProcessedStyleText, StyleTextProcessor } from "./preprocess.js";

/** One raw plugin-reported dependency, pending inventory validation. */
export type StyleDependencyReport =
  | {
      readonly type: "dependency";
      readonly plugin: string;
      readonly source: string;
      readonly file?: string;
      readonly malformed: boolean;
    }
  | {
      readonly type: "dir-dependency";
      readonly plugin: string;
      readonly source: string;
      readonly directory?: string;
      readonly glob?: string;
      readonly malformed: boolean;
    };

/** Apply consumer plugins and retain structured messages for later validation. */
export class PostcssStyleProcessor implements StyleTextProcessor {
  constructor(
    private readonly config: ResolvedConfig,
    private readonly plugins: readonly NormalizedPostcssPlugin[],
  ) {}

  /** Run one physical stylesheet with source maps disabled. */
  async process(source: string, text: string): Promise<ProcessedStyleText> {
    const relative = toPosixPath(path.relative(this.config.repoRoot, source));
    const pending = postcss([...this.plugins]).process(text, {
      from: fs.realpathSync(source),
      map: false,
    });
    let result;
    try {
      result = await pending;
    } catch (error) {
      const lastPlugin = (
        pending as typeof pending & {
          result?: { lastPlugin?: NormalizedPostcssPlugin };
        }
      ).result?.lastPlugin;
      const lastPluginName =
        lastPlugin && "postcssPlugin" in lastPlugin
          ? lastPlugin.postcssPlugin
          : undefined;
      const plugin =
        error !== null &&
        typeof error === "object" &&
        "plugin" in error &&
        typeof error.plugin === "string"
          ? error.plugin
          : (lastPluginName ?? "unknown");
      throw new MoklyError(
        "build-invalid",
        `PostCSS plugin ${plugin} failed for ${relative}: ${errorMessage(error)}; fix the plugin configuration or stylesheet`,
        { cause: error },
      );
    }
    const reports: StyleDependencyReport[] = [];
    for (const message of result.messages) {
      if (message.type !== "dependency" && message.type !== "dir-dependency")
        continue;
      const record: Record<string, unknown> = message;
      const plugin =
        typeof record.plugin === "string" && record.plugin
          ? record.plugin
          : "unknown";
      if (message.type === "dependency") {
        reports.push({
          type: "dependency",
          plugin,
          source,
          ...(typeof record.file === "string" ? { file: record.file } : {}),
          malformed: typeof record.file !== "string" || !record.file,
        });
      } else {
        reports.push({
          type: "dir-dependency",
          plugin,
          source,
          ...(typeof record.dir === "string" ? { directory: record.dir } : {}),
          ...(typeof record.glob === "string" ? { glob: record.glob } : {}),
          malformed:
            typeof record.dir !== "string" ||
            !record.dir ||
            (record.glob !== undefined && typeof record.glob !== "string"),
        });
      }
    }
    return { css: result.css, sourceFiles: [], reports };
  }
}
