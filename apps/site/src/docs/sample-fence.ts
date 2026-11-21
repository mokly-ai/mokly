import path from "node:path";
import { fileURLToPath } from "node:url";

import type { SatteriMarkdownProcessorOptions } from "@astrojs/markdown-satteri";
import type { HastPluginEntry } from "satteri";

import { GUIDE_CONTENT } from "./pages.js";
import { sampleBand } from "./sample-band.js";
import { samplePath } from "./sample-path.js";
import { renderSample } from "./sample-render.js";

type Transformer = NonNullable<
  NonNullable<SatteriMarkdownProcessorOptions["shikiConfig"]>["transformers"]
>[number];

/** Preserve sample metadata that highlighting otherwise drops. */
export const sampleTransformer: Transformer = {
  name: "mokly-sample-meta",
  pre(node) {
    const meta = this.options.meta?.["__raw"];
    if (typeof meta === "string" && meta.startsWith("sample="))
      node.properties["data-sample-meta"] = meta;
  },
};

/** Render only installed guides' sample fences before ordinary code panels. */
export const sampleFence: HastPluginEntry = (context) => {
  if (!context.fileURL) return false;
  const page = path.relative(GUIDE_CONTENT, fileURLToPath(context.fileURL));
  if (page.startsWith("..") || path.isAbsolute(page) || !page.endsWith(".md"))
    return false;
  return {
    name: "mokly-sample-fence",
    element: {
      filter: ["pre"],
      async visit(node, ctx) {
        const meta = node.properties["data-sample-meta"];
        if (typeof meta !== "string" || !meta.startsWith("sample=")) return;
        const file = samplePath(meta);
        const language =
          node.properties["data-language"] ?? node.properties["dataLanguage"];
        try {
          if (!file || language !== "html")
            throw new Error(
              "Expected html sample=specs/{file}.screen.html with one valid sample path.",
            );
          const source = ctx.textContent(node);
          return sampleBand(node, file, await renderSample(file, source));
        } catch (error) {
          throw new Error(
            `${page}: sample ${meta.slice("sample=".length)}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
      },
    },
  };
};
