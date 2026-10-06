import path from "node:path";

import { minimatch } from "minimatch";

import type { ColorScheme, ComponentViewRecord } from "@mokly/viewer";
import type { ArtifactView } from "@mokly/viewer/data";
import {
  entryRoute,
  documentRoute,
  effectiveColorSchemes,
  viewRoute,
  VIEWPORTS,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { componentInputs } from "../components/inputs.js";
import type {
  ComponentGraphRenderer,
  LinkedComponentStylesheet,
} from "../components/render.js";
import { rebaseStyleOwnership } from "../components/style_ownership.js";
import {
  isComponentVariantDefinition,
  type ComponentDefinition,
} from "../components/types.js";
import {
  isPublicStaticFile,
  publicFileFailureReason,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { documentTemplate } from "../documents/template.js";
import { MoklyError, errorMessage } from "../errors.js";
import { serializeReviewSentinels } from "../renderer/sentinels.js";
import type { Renderer } from "../renderer/types.js";

import type { BuildDiagnostic } from "./build_warnings.js";
import { generatedHeader } from "./ownership.js";
import { renderPage } from "./render_page.js";
import { rendererWithoutCssOwners } from "./renderer_resources.js";
import { stylesheetHref, type StyleDelivery } from "./styles/links.js";
import { isGeneratedRoute } from "./styles/routes.js";

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
  },
  styles?: StyleDelivery,
  onWarning?: (warning: BuildDiagnostic) => void,
  stylesheetLinks?: Map<string, readonly LinkedComponentStylesheet[]>,
): Map<string, string> {
  const outputs = new Map<string, string>();
  const components = entries.filter(
    (entry): entry is ComponentDefinition & ResolvedRegistryEntry =>
      entry.kind === "component" && !isComponentVariantDefinition(entry),
  );
  const componentById = new Map(components.map((entry) => [entry.path, entry]));
  const ordered = [
    ...entries.filter((entry) => entry.kind !== "page"),
    ...entries.filter((entry) => entry.kind === "page"),
  ];
  for (const entry of ordered) {
    if (selection && selection.entryId !== entry.path) continue;
    if (entry.kind === "document") {
      for (const colorScheme of config.colorSchemes) {
        if (selection && selection.colorScheme !== colorScheme) continue;
        const route = documentRoute(entry.path, colorScheme);
        addOutput(
          outputs,
          route,
          generatedHeader(entry.sourceRelativePath) +
            documentTemplate(entry.title, entry.body, colorScheme),
        );
        fragmentViews.set(route, { colorScheme, viewport: "desktop" });
      }
      continue;
    }
    if (entry.kind === "page") {
      const route = entryRoute(entry.path);
      addOutput(outputs, route, renderPage(entry));
      fragmentViews.set(route, {
        colorScheme: "light",
        viewport: "desktop",
      });
      continue;
    }
    if (
      entry.kind !== "screen" &&
      !(entry.kind === "component" && isComponentVariantDefinition(entry))
    )
      continue;
    {
      for (const viewport of VIEWPORTS) {
        for (const colorScheme of effectiveColorSchemes(
          entry,
          config.colorSchemes,
        )) {
          if (
            selection &&
            (selection.viewport !== viewport ||
              selection.colorScheme !== colorScheme)
          )
            continue;
          const route = viewRoute(entry.path, viewport, colorScheme);
          const placement = stylesheetPlacementFor(
            entryRoute(entry.path),
            route,
            colorScheme,
            config,
            entry.entryRoot,
            styles,
          );
          const stylesheets = placement.hrefs;
          let rendered: string;
          const safeRenderer = rendererWithoutCssOwners(
            renderer,
            route,
            config,
            styles?.pending,
            onWarning,
          );
          try {
            const componentProps =
              entry.kind === "component"
                ? componentInputs(
                    componentById.get(entry.variantOf)!,
                    entry.props,
                    `${entry.variantOf} / ${entry.path}`,
                  ).data
                : undefined;
            const input = {
              colorScheme,
              entry,
              node: entry.kind === "screen" ? entry[viewport] : null,
              stylesheets,
              viewport,
              ...(componentProps ? { componentProps } : {}),
            };
            if (components.length) {
              const output = graphRenderer(input, safeRenderer, components, {
                route,
                position: placement.position,
                configuredHrefs: placement.configuredHrefs,
                mockupsDir: config.mockupsDir,
              });
              rendered = output.html;
              stylesheetLinks?.set(route, output.stylesheetLinks);
              if (onWarning) output.diagnostics?.forEach(onWarning);
              componentViews.set(route, {
                ...output.view,
                styles: rebaseStyleOwnership(
                  rendered,
                  generatedHeader(entry.sourceRelativePath) + rendered,
                  output.view.styles,
                ),
              });
            } else {
              const result = safeRenderer(input);
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
              `renderer failed for ${entry.path} (${viewport}, ${colorScheme}): ${errorMessage(error)}`,
              { cause: error },
            );
          }
          if (typeof rendered !== "string" || !/<html[\s>]/i.test(rendered)) {
            throw new MoklyError(
              "build-invalid",
              `renderer must return a complete HTML document for ${entry.path} (${viewport}, ${colorScheme})`,
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
function addOutput(
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

export interface StylesheetPlacement {
  hrefs: string[];
  configuredHrefs: string[];
  position: number;
}

/** Configured links exclude the marker, while its position stays route-local. */
export function stylesheetPlacementFor(
  catalogueRoute: string,
  viewPath: string,
  colorScheme: ColorScheme,
  config: ResolvedConfig,
  entryRoot?: string,
  styles?: StyleDelivery,
): StylesheetPlacement {
  const rule = config.stylesheets.find((candidate) =>
    minimatch(catalogueRoute, candidate.match),
  );
  const configured = [
    ...(rule?.stylesheets ?? []),
    ...(colorScheme === "light"
      ? (rule?.lightStylesheets ?? [])
      : (rule?.darkStylesheets ?? [])),
  ];
  const local = configured.map((stylesheet) => {
    if (/^https?:\/\//.test(stylesheet)) return stylesheet;
    const absolute = path.resolve(config.mockupsDir, stylesheet);
    if (
      !styles?.pending.has(stylesheet) &&
      (isGeneratedRoute(stylesheet) || !isPublicStaticFile(absolute, config))
    ) {
      const denial = publicFileFailureReason(absolute, config);
      throw new MoklyError(
        "build-invalid",
        `${catalogueRoute}: ${denial ? `stylesheet ${stylesheet} ${denial}` : `stylesheet does not exist: ${stylesheet}`}`,
      );
    }
    return stylesheetHref(viewPath, stylesheet);
  });
  const configuredHrefs = [...local];
  for (const root of [config.renderer, entryRoot]) {
    const route = root && styles?.routes.get(root);
    if (route) local.push(stylesheetHref(viewPath, route));
  }
  return {
    hrefs: local,
    configuredHrefs,
    position: rule?.componentPosition ?? rule?.stylesheets.length ?? 0,
  };
}
