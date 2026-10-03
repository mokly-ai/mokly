import fs from "node:fs";
import path from "node:path";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import {
  isInternalCatalogueFile,
  isPublicStaticFile,
  privateStaticPathReason,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import { exportResourceDenial } from "../export/resource_policy.js";
import {
  fragmentViolation,
  htmlResource,
  type ParsedResource,
  type ResourceReference,
} from "../html_link_validation.js";
import {
  extractCssReferences,
  extractHtmlReferences,
  resolveLocalReferencePath,
} from "../html_references.js";
import { classifyResourceUrl } from "../resource_url.js";

import { PendingGeneratedFiles } from "./pending_generated.js";
import { validateImageSetStrings } from "./styles/image_set.js";

/** Generation-scoped resource parsing, shared by complete and demand compilation. */
export interface HtmlValidationContext {
  pending: PendingGeneratedFiles;
  parsed: Map<string, ParsedResource>;
  onDemand: boolean;
}

interface ReferenceResult {
  target?: string;
  violation?: string;
}

/** Validate generated resources and return only their referenced authored closure. */
export function validateHtmlLinks(
  outputs: ReadonlyMap<string, string>,
  config: ResolvedConfig,
  context?: HtmlValidationContext,
  resourceSeeds: readonly string[] = [],
): string[] {
  const pendingFiles = context?.pending ?? new PendingGeneratedFiles(new Map());
  if (!context) pendingFiles.addHtmlMap(outputs);
  const parsed = context?.parsed ?? new Map<string, ParsedResource>();
  const denial = exportResourceDenial(config);
  for (const [route, content] of outputs) {
    if (route.endsWith(".html"))
      parsed.set(
        generatedRoute(route),
        htmlResource(extractHtmlReferences(content)),
      );
  }
  for (const route of pendingFiles.stylesheetRoutes()) {
    const resource = pendingFiles.resource(route);
    if (resource) parsed.set(generatedRoute(route), resource);
  }
  const pending = [
    ...new Set([...outputs.keys(), ...pendingFiles.stylesheetRoutes()]),
  ]
    .map(generatedRoute)
    .filter((route) => parsed.has(route))
    .concat(resourceSeeds)
    .sort();
  const visited = new Set<string>();
  const closure = new Set<string>();
  const violations: string[] = [];
  while (pending.length) {
    const route = pending.shift();
    if (!route || visited.has(route)) continue;
    visited.add(route);
    const resource =
      parsed.get(route) ?? loadResource(route, pendingFiles, config);
    if (!resource) continue;
    parsed.set(route, resource);
    if (generatedRelative(route) === undefined) closure.add(route);
    for (const reference of resource.references) {
      const result = validateReference(
        reference,
        route,
        resource,
        parsed,
        config,
        pendingFiles,
        context?.onDemand ?? false,
        denial,
      );
      if (result.violation) violations.push(`${route}: ${result.violation}`);
      if (
        result.target &&
        !visited.has(result.target) &&
        !pending.includes(result.target)
      ) {
        pending.push(result.target);
        pending.sort();
      }
    }
  }
  if (violations.length)
    throw new MoklyError(
      "build-invalid",
      `document links and resources are invalid:\n${violations
        .sort()
        .map((item) => `- ${item}`)
        .join("\n")}`,
    );
  return [...closure].sort();
}

function generatedRoute(route: string): string {
  return `${GENERATED_DIRECTORY}/${route}`;
}

function generatedRelative(route: string): string | undefined {
  const prefix = `${GENERATED_DIRECTORY}/`;
  return route.startsWith(prefix) ? route.slice(prefix.length) : undefined;
}

function validateReference(
  item: ResourceReference,
  sourceRoute: string,
  source: ParsedResource,
  parsed: Map<string, ParsedResource>,
  config: ResolvedConfig,
  pending: PendingGeneratedFiles,
  onDemand: boolean,
  resourceDenial: (route: string) => string | undefined,
): ReferenceResult {
  const reference = item.value;
  if (
    classifyResourceUrl(
      reference,
      sourceRoute.endsWith(".css") ? "css" : "html",
    ).kind === "external"
  )
    return {};
  if (reference.startsWith("mock:"))
    return { violation: `unresolved id link ${reference}` };
  if (reference.startsWith("/"))
    return { violation: `root-absolute link is not portable: ${reference}` };
  if (reference.startsWith("#") || reference.startsWith("?")) {
    const violation = item.checkFragment
      ? fragmentViolation(reference, source.anchors)
      : undefined;
    return violation ? { violation } : {};
  }
  const resolved = resolveLocalReferencePath(sourceRoute, reference);
  if (resolved.kind === "invalid-encoding")
    return { violation: `invalid URL encoding: ${reference}` };
  if (resolved.kind === "root-absolute")
    return { violation: `root-absolute link is not portable: ${reference}` };
  if (resolved.kind !== "resolved")
    return { violation: `link escapes mockupsDir: ${reference}` };
  const target = resolved.path;
  const candidate = path.resolve(config.mockupsDir, target);
  const generated = generatedRelative(target);
  if (isInternalCatalogueFile(candidate, config, generated === undefined))
    return {
      violation: `protected target ${reference}: targets internal catalogue metadata`,
    };
  if (generated !== undefined) {
    if (!pending.has(generated))
      return { violation: `missing target ${reference}` };
    if (onDemand && item.checkFragment && !reference.includes("#")) return {};
  } else {
    const denial =
      privateStaticPathReason(candidate, config) ?? resourceDenial(target);
    if (denial)
      return { violation: `protected target ${reference}: ${denial}` };
  }
  const resource = parsed.get(target) ?? loadResource(target, pending, config);
  if (!resource) return { violation: `missing target ${reference}` };
  parsed.set(target, resource);
  const violation = item.checkFragment
    ? fragmentViolation(reference, resource.anchors)
    : undefined;
  if (violation) return { violation };
  return onDemand && item.checkFragment ? {} : { target };
}

function loadResource(
  route: string,
  pending: PendingGeneratedFiles,
  config: ResolvedConfig,
): ParsedResource | undefined {
  const generated = generatedRelative(route);
  if (generated !== undefined) return pending.resource(generated);
  const candidate = path.resolve(config.mockupsDir, route);
  if (!isPublicStaticFile(candidate, config)) return;
  let checked = config.mockupsDir;
  for (const segment of route.split("/")) {
    checked = path.join(checked, segment);
    if (fs.lstatSync(checked).isSymbolicLink()) return;
  }
  const extension = path.posix.extname(route).toLowerCase();
  if (![".css", ".html", ".htm"].includes(extension))
    return { anchors: new Set(), references: [] };
  const content = fs.readFileSync(candidate, "utf8");
  if (extension === ".css") {
    validateImageSetStrings(content, candidate, config.repoRoot);
    return {
      anchors: new Set(),
      references: extractCssReferences(content).map((value) => ({
        checkFragment: false,
        value,
      })),
    };
  }
  return htmlResource(extractHtmlReferences(content));
}
