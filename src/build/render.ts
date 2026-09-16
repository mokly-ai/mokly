import path from "node:path";

import { minimatch } from "minimatch";

import type { ColorScheme, ResolvedRegistryEntry } from "../authoring/types.js";
import type { ComponentViewRecord } from "../components/manifest_types.js";
import { componentFragmentRoute } from "../components/paths.js";
import type { ComponentGraphRenderer } from "../components/render.js";
import { rebaseStyleOwnership } from "../components/style_ownership.js";
import { encodeUrlPath, toPosixPath } from "../config/paths.js";
import {
  isPublicStaticFile,
  publicFileFailureReason,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import { fragmentRoute } from "../registry/manifest.js";
import type { ArtifactView } from "../registry/views.js";
import { effectiveColorSchemes, VIEWPORTS } from "../registry/views.js";
import { serializeReviewSentinels } from "../renderer/sentinels.js";
import type { Renderer } from "../renderer/types.js";

import { generatedHeader } from "./ownership.js";
import { renderPage } from "./render_page.js";

/** Render every screen view to owned, linked static documents. */
export function renderFragments(
  entries: readonly ResolvedRegistryEntry[],
  renderer: Renderer,
  config: ResolvedConfig,
  fragmentViews: Map<string, ArtifactView>,
  graphRenderer: ComponentGraphRenderer,
  componentViews: Map<string, ComponentViewRecord>,
  selection?: {
    entryId: string;
    viewport: "mobile" | "desktop";
    colorScheme: ColorScheme;
    variantId?: string;
  },
): Map<string, string> {
  const outputs = new Map<string, string>();
  const components = entries.filter((entry) => entry.kind === "component");
  const ordered = [
    ...entries.filter((entry) => entry.kind !== "page"),
    ...entries.filter((entry) => entry.kind === "page"),
  ];
  for (const entry of ordered) {
    if (selection && selection.entryId !== entry.id) continue;
    if (entry.kind === "page") {
      addOutput(outputs, entry.route, renderPage(entry));
      fragmentViews.set(entry.route, {
        colorScheme: "light",
        viewport: "desktop",
      });
      continue;
    }
    if (entry.kind !== "screen" && entry.kind !== "component") continue;
    for (const variantId of entry.kind === "component"
      ? entry.variants.map((variant) => variant.id)
      : [undefined]) {
      for (const viewport of VIEWPORTS) {
        for (const colorScheme of effectiveColorSchemes(
          entry,
          config.colorSchemes,
        )) {
          if (
            selection &&
            (selection.variantId !== variantId ||
              selection.viewport !== viewport ||
              selection.colorScheme !== colorScheme)
          )
            continue;
          const route = variantId
            ? componentFragmentRoute(
                entry.route,
                variantId,
                viewport,
                colorScheme,
              )
            : fragmentRoute(entry.route, viewport, colorScheme);
          const stylesheets = stylesheetsFor(
            entry.route,
            route,
            colorScheme,
            config,
          );
          let rendered: string;
          try {
            const input = {
              colorScheme,
              entry,
              node: entry.kind === "screen" ? entry[viewport] : null,
              stylesheets,
              viewport,
              ...(variantId ? { variantId } : {}),
            };
            if (components.length) {
              const output = graphRenderer(input, renderer, components);
              rendered = output.html;
              componentViews.set(route, {
                ...output.view,
                styles: rebaseStyleOwnership(
                  rendered,
                  generatedHeader(entry.sourceRelativePath) + rendered,
                  output.view.styles,
                ),
              });
            } else {
              const result = renderer(input);
              rendered = typeof result === "string" ? result : result.html;
              if (
                typeof result !== "string" &&
                (result.styles?.length || result.resources?.length)
              )
                throw new Error(
                  "component ownership requires registered components",
                );
            }
          } catch (error) {
            throw new MoklyError(
              "build-invalid",
              `renderer failed for ${entry.id} (${viewport}, ${colorScheme}): ${errorMessage(error)}`,
              { cause: error },
            );
          }
          if (typeof rendered !== "string" || !/<html[\s>]/i.test(rendered)) {
            throw new MoklyError(
              "build-invalid",
              `renderer must return a complete HTML document for ${entry.id} (${viewport}, ${colorScheme})`,
            );
          }
          addOutput(
            outputs,
            route,
            `${generatedHeader(entry.sourceRelativePath)}${serializeReviewSentinels(rendered)}`,
          );
          fragmentViews.set(route, { colorScheme, viewport });
        }
      }
    }
  }
  return outputs;
}

/** Add one output and fail on a route collision. */
export function addOutput(
  outputs: Map<string, string>,
  route: string,
  content: string,
): void {
  if (outputs.has(route)) {
    throw new MoklyError(
      "build-invalid",
      `generated route collision: ${route}`,
    );
  }
  outputs.set(route, content.endsWith("\n") ? content : `${content}\n`);
}

export function stylesheetsFor(
  catalogueRoute: string,
  fragmentRoute: string,
  colorScheme: ColorScheme,
  config: ResolvedConfig,
): string[] {
  const rule = config.stylesheets.find((candidate) =>
    minimatch(catalogueRoute, candidate.match),
  );
  if (!rule) return [];
  const configured = [
    ...rule.stylesheets,
    ...(colorScheme === "light"
      ? (rule.lightStylesheets ?? [])
      : (rule.darkStylesheets ?? [])),
  ];
  return configured.map((stylesheet) => {
    if (/^https?:\/\//.test(stylesheet)) return stylesheet;
    const absolute = path.resolve(config.mockupsDir, stylesheet);
    if (!isPublicStaticFile(absolute, config)) {
      const denial = publicFileFailureReason(absolute, config);
      throw new MoklyError(
        "build-invalid",
        `${catalogueRoute}: ${denial ? `stylesheet ${stylesheet} ${denial}` : `stylesheet does not exist: ${stylesheet}`}`,
      );
    }
    const relative = path.posix.relative(
      path.posix.dirname(fragmentRoute),
      stylesheet,
    );
    const encoded = encodeUrlPath(relative);
    return encoded.startsWith(".") ? encoded : `./${encoded}`;
  });
}

/** Normalize an absolute source path for deterministic diagnostics. */
export function sourceLabel(
  config: ResolvedConfig,
  sourcePath: string,
): string {
  return toPosixPath(path.relative(config.repoRoot, sourcePath));
}
