import fs from "node:fs";
import path from "node:path";

import { GENERATED_DIRECTORY } from "../config/paths.js";
import {
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

import { isOwned, pendingGeneratedOrphanRoutes } from "./ownership.js";

interface ReferenceResult {
  target?: string;
  violation?: string;
}

/** Generation-scoped lookup for validating a requested document and its resources. */
export interface HtmlValidationContext {
  generatedRoutes: ReadonlySet<string>;
  readGenerated(route: string): string;
  parsed: Map<string, ParsedResource>;
  pendingOrphans: ReadonlySet<string>;
}

/** Validate navigation links and transitive local resources in generated HTML. */
export function validateHtmlLinks(
  outputs: ReadonlyMap<string, string>,
  config: ResolvedConfig,
  context?: HtmlValidationContext,
  resourceSeeds: readonly string[] = [],
): string[] {
  const pendingOrphans =
    context?.pendingOrphans ??
    new Set(pendingGeneratedOrphanRoutes(config, outputs.keys()));
  const parsed = context?.parsed ?? new Map<string, ParsedResource>();
  const resourceDenial = exportResourceDenial(config);
  for (const [route, content] of outputs) {
    if (!route.endsWith(".html")) continue;
    parsed.set(
      generatedRoute(route),
      htmlResource(extractHtmlReferences(content)),
    );
  }
  const pending = [...outputs.keys()]
    .map(generatedRoute)
    .filter((route) => parsed.has(route))
    .concat(resourceSeeds)
    .sort();
  const visited = new Set<string>();
  const violations: string[] = [];
  while (pending.length > 0) {
    const route = pending.shift();
    if (!route || visited.has(route)) continue;
    visited.add(route);
    const resource =
      parsed.get(route) ??
      loadResource(route, outputs, config, pendingOrphans, context);
    if (!resource) continue;
    parsed.set(route, resource);
    for (const reference of resource.references) {
      const result = validateReference(
        reference,
        route,
        resource,
        parsed,
        config,
        pendingOrphans,
        context,
        resourceDenial,
      );
      if (result.violation) violations.push(`${route}: ${result.violation}`);
      if (
        result.target &&
        !visited.has(result.target) &&
        !pending.includes(result.target)
      ) {
        const targetResource =
          parsed.get(result.target) ??
          loadResource(result.target, outputs, config, pendingOrphans, context);
        if (targetResource) {
          parsed.set(result.target, targetResource);
          pending.push(result.target);
          pending.sort();
        }
      }
    }
  }
  if (violations.length > 0) {
    throw new MoklyError(
      "build-invalid",
      `document links and resources are invalid:\n${violations
        .sort()
        .map((item) => `- ${item}`)
        .join("\n")}`,
    );
  }
  return [...visited]
    .filter((route) => !route.startsWith(`${GENERATED_DIRECTORY}/`))
    .sort();
}

function generatedRoute(route: string): string {
  return path.posix.join(GENERATED_DIRECTORY, route);
}

function validateReference(
  item: ResourceReference,
  sourceRoute: string,
  source: ParsedResource,
  parsed: Map<string, ParsedResource>,
  config: ResolvedConfig,
  pendingOrphans: ReadonlySet<string>,
  context?: HtmlValidationContext,
  resourceDenial?: (route: string) => string | undefined,
): ReferenceResult {
  const reference = item.value;
  if (reference === "" || /^(?:https?:|mailto:|tel:|data:)/i.test(reference)) {
    return {};
  }
  if (reference.startsWith("mock:")) {
    return { violation: `unresolved id link ${reference}` };
  }
  if (reference.startsWith("/")) {
    return { violation: `root-absolute link is not portable: ${reference}` };
  }
  if (reference.startsWith("#") || reference.startsWith("?")) {
    const violation = item.checkFragment
      ? fragmentViolation(reference, source.anchors)
      : undefined;
    return violation ? { violation } : {};
  }
  const resolved = resolveLocalReferencePath(sourceRoute, reference);
  if (resolved.kind === "invalid-encoding") {
    return { violation: `invalid URL encoding: ${reference}` };
  }
  if (resolved.kind === "root-absolute") {
    return { violation: `root-absolute link is not portable: ${reference}` };
  }
  if (resolved.kind !== "resolved") {
    return { violation: `link escapes mockupsDir: ${reference}` };
  }
  const target = resolved.path;
  const knownGenerated =
    target.startsWith(`${GENERATED_DIRECTORY}/`) &&
    (context?.generatedRoutes.has(
      target.slice(GENERATED_DIRECTORY.length + 1),
    ) ||
      parsed.has(target));
  if (
    target.startsWith(`${GENERATED_DIRECTORY}/`) &&
    /\.html?$/i.test(target) &&
    !knownGenerated
  )
    return { violation: `missing target ${reference}` };
  if (knownGenerated && item.checkFragment && !reference.includes("#"))
    return {};
  const denial = knownGenerated
    ? undefined
    : (privateStaticPathReason(
        path.resolve(config.mockupsDir, target),
        config,
      ) ?? resourceDenial?.(target));
  if (denial) return { violation: `protected target ${reference}: ${denial}` };
  let targetResource = parsed.get(target);
  if (knownGenerated) {
    if (!targetResource && context) {
      targetResource = htmlResource(
        extractHtmlReferences(
          context.readGenerated(target.slice(GENERATED_DIRECTORY.length + 1)),
        ),
      );
      parsed.set(target, targetResource);
    }
  }
  if (!targetResource) {
    targetResource = loadResource(
      target,
      new Map(),
      config,
      pendingOrphans,
      context,
    );
    if (!targetResource) return { violation: `missing target ${reference}` };
    parsed.set(target, targetResource);
  }
  const violation = item.checkFragment
    ? fragmentViolation(reference, targetResource.anchors)
    : undefined;
  if (violation) return { violation };
  return { target };
}

function loadResource(
  route: string,
  outputs: ReadonlyMap<string, string>,
  config: ResolvedConfig,
  pendingOrphans: ReadonlySet<string>,
  context?: HtmlValidationContext,
): ParsedResource | undefined {
  if (route.startsWith(`${GENERATED_DIRECTORY}/`)) {
    if (
      context &&
      !context.generatedRoutes.has(
        route.slice(GENERATED_DIRECTORY.length + 1),
      ) &&
      !outputs.has(route.slice(GENERATED_DIRECTORY.length + 1))
    )
      return undefined;
    const generated =
      outputs.get(route.slice(GENERATED_DIRECTORY.length + 1)) ??
      context?.readGenerated(route.slice(GENERATED_DIRECTORY.length + 1));
    return generated === undefined
      ? undefined
      : htmlResource(extractHtmlReferences(generated));
  }
  const candidate = path.resolve(config.mockupsDir, route);
  if (context && isOwned(candidate, config)) return undefined;
  if (pendingOrphans.has(route)) return undefined;
  if (!isPublicStaticFile(candidate, config)) return undefined;
  if (
    fs.lstatSync(candidate).isSymbolicLink() ||
    fs.realpathSync(candidate) !== candidate
  )
    return undefined;
  const extension = path.posix.extname(route).toLowerCase();
  if (extension !== ".css" && extension !== ".html" && extension !== ".htm") {
    return { anchors: new Set(), references: [] };
  }
  const content = fs.readFileSync(candidate, "utf8");
  return extension === ".css"
    ? {
        anchors: new Set(),
        references: extractCssReferences(content).map((value) => ({
          checkFragment: false,
          value,
        })),
      }
    : htmlResource(extractHtmlReferences(content));
}
