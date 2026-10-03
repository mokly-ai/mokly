import fs from "node:fs";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import {
  isPrivateStaticPath,
  isPublicStaticFile,
  privateStaticPathReason,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import {
  fragmentViolation,
  htmlResource,
  type ParsedResource,
  type ResourceReference,
} from "../html_link_validation.js";
import {
  extractCssReferences,
  extractHtmlReferences,
} from "../html_references.js";
import { classifyResourceUrl } from "../resource_url.js";

import { isOwned, pendingGeneratedOrphanRoutes } from "./ownership.js";
import { PendingGeneratedFiles } from "./pending_generated.js";
import { validateImageSetStrings } from "./styles/image_set.js";
import { isGeneratedRoute } from "./styles/routes.js";

interface ReferenceResult {
  target?: string;
  violation?: string;
}

/** Generation-scoped lookup for validating a requested document and its resources. */
export interface HtmlValidationContext {
  pending: PendingGeneratedFiles;
  parsed: Map<string, ParsedResource>;
  pendingOrphans?: ReadonlySet<string>;
  onDemand: boolean;
}

/** Validate navigation links and transitive local resources in generated HTML. */
export function validateHtmlLinks(
  outputs: ReadonlyMap<string, string>,
  config: ResolvedConfig,
  context?: HtmlValidationContext,
): void {
  const pendingFiles = context?.pending ?? new PendingGeneratedFiles(new Map());
  if (!context) pendingFiles.addHtmlMap(outputs);
  const pendingOrphans =
    context?.pendingOrphans ??
    new Set(
      pendingGeneratedOrphanRoutes(config, [
        ...pendingFiles.routes(),
        ...outputs.keys(),
      ]),
    );
  const parsed = context?.parsed ?? new Map<string, ParsedResource>();
  for (const [route, content] of outputs) {
    if (isPrivateStaticPath(path.resolve(config.mockupsDir, route), config))
      continue;
    parsed.set(route, htmlResource(extractHtmlReferences(content)));
  }
  for (const route of pendingFiles.stylesheetRoutes()) {
    const resource = pendingFiles.resource(route);
    if (resource) parsed.set(route, resource);
  }
  const pending = [
    ...new Set([...outputs.keys(), ...pendingFiles.stylesheetRoutes()]),
  ]
    .filter((route) => parsed.has(route))
    .sort();
  const visited = new Set<string>();
  const violations: string[] = [];
  while (pending.length > 0) {
    const route = pending.shift();
    if (!route || visited.has(route)) continue;
    visited.add(route);
    const resource = parsed.get(route);
    if (!resource) continue;
    for (const reference of resource.references) {
      const result = validateReference(
        reference,
        route,
        resource,
        parsed,
        config,
        pendingOrphans,
        pendingFiles,
        context?.onDemand ?? false,
      );
      if (result.violation) violations.push(`${route}: ${result.violation}`);
      if (
        result.target &&
        !visited.has(result.target) &&
        !pending.includes(result.target)
      ) {
        const targetResource =
          parsed.get(result.target) ??
          loadResource(
            result.target,
            pendingFiles,
            config,
            pendingOrphans,
            context?.onDemand ?? false,
          );
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
}

function validateReference(
  item: ResourceReference,
  sourceRoute: string,
  source: ParsedResource,
  parsed: Map<string, ParsedResource>,
  config: ResolvedConfig,
  pendingOrphans: ReadonlySet<string>,
  pending: PendingGeneratedFiles,
  onDemand: boolean,
): ReferenceResult {
  const reference = item.value;
  if (
    classifyResourceUrl(
      reference,
      sourceRoute.endsWith(".css") ? "css" : "html",
    ).kind === "external"
  )
    return {};
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
  const [withoutHash] = reference.split("#", 2);
  const rawPath = (withoutHash ?? "").split("?", 1)[0] ?? "";
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return { violation: `invalid URL encoding: ${reference}` };
  }
  if (decodedPath.startsWith("/") || decodedPath.startsWith("\\")) {
    return { violation: `root-absolute link is not portable: ${reference}` };
  }
  const rawTarget = path.posix.normalize(
    path.posix.join(path.posix.dirname(sourceRoute), decodedPath),
  );
  if (
    rawTarget === ".." ||
    rawTarget.startsWith("../") ||
    !isSafeRepositoryPath(rawTarget)
  ) {
    return { violation: `link escapes mockupsDir: ${reference}` };
  }
  const target = rawTarget.replace(/^\.\//, "");
  const denial =
    isGeneratedRoute(target) && pending.has(target)
      ? undefined
      : privateStaticPathReason(
          path.resolve(config.mockupsDir, target),
          config,
        );
  if (denial) return { violation: `protected target ${reference}: ${denial}` };
  let targetResource = parsed.get(target);
  if (pending.has(target)) {
    if (item.checkFragment && !reference.includes("#")) return {};
    targetResource ??= pending.resource(target);
    if (targetResource) parsed.set(target, targetResource);
  }
  if (!targetResource) {
    targetResource = loadResource(
      target,
      pending,
      config,
      pendingOrphans,
      onDemand,
    );
    if (!targetResource) return { violation: `missing target ${reference}` };
    parsed.set(target, targetResource);
  }
  const violation = item.checkFragment
    ? fragmentViolation(reference, targetResource.anchors)
    : undefined;
  if (violation) return { violation };
  return onDemand && item.checkFragment ? {} : { target };
}

function loadResource(
  route: string,
  pending: PendingGeneratedFiles,
  config: ResolvedConfig,
  pendingOrphans: ReadonlySet<string>,
  onDemand: boolean,
): ParsedResource | undefined {
  if (pending.has(route)) return pending.resource(route);
  if (isGeneratedRoute(route)) return undefined;
  const candidate = path.resolve(config.mockupsDir, route);
  if (isPrivateStaticPath(candidate, config)) return undefined;
  if (onDemand && isOwned(candidate, config)) return undefined;
  if (pendingOrphans.has(route)) return undefined;
  if (!isPublicStaticFile(candidate, config)) return undefined;
  const extension = path.posix.extname(route).toLowerCase();
  if (extension !== ".css" && extension !== ".html" && extension !== ".htm") {
    return { anchors: new Set(), references: [] };
  }
  const content = fs.readFileSync(candidate, "utf8");
  if (extension === ".css")
    validateImageSetStrings(content, candidate, config.repoRoot);
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
