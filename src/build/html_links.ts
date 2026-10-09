import path from "node:path";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { isInternalCatalogueFile } from "../config/public_files.js";
import { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import {
  fragmentViolation,
  htmlResource,
  type ParsedResource,
  type ResourceReference,
} from "../html_link_validation.js";
import {
  extractHtmlReferences,
  resolveLocalReferencePath,
} from "../html_references.js";
import { classifyResourceUrl } from "../resource_url.js";

import { PendingGeneratedFiles } from "./pending_generated.js";
import { loadPublicResource } from "./public_resource.js";
import { resourceSeedOrigins, type ResourceSeed } from "./resource_seeds.js";

/** Generation-scoped resource parsing, shared by complete and demand compilation. */
export interface HtmlValidationContext {
  pending: PendingGeneratedFiles;
  parsed: Map<string, ParsedResource>;
  onDemand: boolean;
  policy?: PublicFilePolicy;
  watch?: boolean;
  resourceSeedsForRoute?: (route: string) => readonly ResourceSeed[];
}

interface ReferenceResult {
  target?: string;
  violation?: string;
}

/** Traversal evidence belongs to the same checked closure as Build output. */
export interface PublicClosureSnapshot {
  closure: ReadonlySet<string>;
  references: ReadonlyMap<string, readonly string[]>;
  locations: ReadonlyMap<string, readonly string[]>;
  invalid: ReadonlySet<string>;
}

/** Validate generated resources and return only their referenced authored closure. */
export function validateHtmlLinks(
  outputs: ReadonlyMap<string, string>,
  config: ResolvedConfig,
  context?: HtmlValidationContext,
  resourceSeeds: readonly (string | ResourceSeed)[] = [],
): string[] {
  return [
    ...buildPublicClosure(outputs, config, context, resourceSeeds).closure,
  ].sort();
}

/** One traversal for full compilation, requested views, watching and publication. */
export function buildPublicClosure(
  outputs: ReadonlyMap<string, string>,
  config: ResolvedConfig,
  context?: HtmlValidationContext,
  resourceSeeds: readonly (string | ResourceSeed)[] = [],
  recovery?: PublicClosureSnapshot,
): PublicClosureSnapshot {
  const pendingFiles = context?.pending ?? new PendingGeneratedFiles(new Map());
  if (!context) pendingFiles.addHtmlMap(outputs);
  const parsed = context?.parsed ?? new Map<string, ParsedResource>();
  const policy = context?.policy ?? new PublicFilePolicy(config);
  const references = new Map<string, readonly string[]>();
  const locations = new Map<string, readonly string[]>();
  const invalid = new Set<string>();
  for (const [route, content] of outputs)
    if (route.endsWith(".html"))
      parsed.set(
        generatedRoute(route),
        htmlResource(extractHtmlReferences(content)),
      );
  for (const route of pendingFiles.stylesheetRoutes()) {
    const resource = pendingFiles.resource(route);
    if (resource) parsed.set(generatedRoute(route), resource);
  }
  const origins = resourceSeedOrigins(
    resourceSeeds,
    outputs.keys().next().value,
  );
  const queue = [
    ...new Set([...outputs.keys(), ...pendingFiles.stylesheetRoutes()]),
  ]
    .map(generatedRoute)
    .filter((route) => parsed.has(route))
    .concat([...origins.keys()])
    .sort();
  const queued = new Set(queue);
  const visited = new Set<string>();
  const closure = new Set<string>();
  const violations: string[] = [];
  for (let index = 0; index < queue.length; index++) {
    const route = queue[index]!;
    if (visited.has(route)) continue;
    visited.add(route);
    const authored = generatedRelative(route) === undefined;
    if (authored)
      locations.set(route, [path.resolve(config.mockupsDir, route)]);
    const decision = authored ? policy.inspect(route) : undefined;
    if (decision && "location" in decision && decision.location)
      locations.set(route, [
        ...new Set([
          decision.location.logicalPath,
          decision.location.physicalPath,
        ]),
      ]);
    const resource =
      decision && decision.kind !== "public"
        ? undefined
        : (parsed.get(route) ??
          loadPublicResource(route, pendingFiles, policy, config));
    if (!resource) {
      invalid.add(route);
      const reason =
        decision?.kind === "private"
          ? `protected target ${route}: ${decision.reason}`
          : `missing target ${route}`;
      violations.push(`${origins.get(route) ?? route}: ${reason}`);
      const prior = recovery?.references.get(route) ?? [];
      references.set(route, prior);
      for (const target of prior)
        if (!queued.has(target)) {
          queued.add(target);
          queue.push(target);
        }
      continue;
    }
    parsed.set(route, resource);
    const generated = generatedRelative(route);
    if (generated !== undefined && /\.html?$/i.test(route))
      for (const seed of context?.resourceSeedsForRoute?.(generated) ?? []) {
        origins.set(seed.path, seed.sourceRoute);
        if (!queued.has(seed.path)) {
          queued.add(seed.path);
          queue.push(seed.path);
        }
      }
    if (authored) closure.add(route);
    const edges: string[] = [];
    for (const reference of resource.references) {
      const result = validateReference(
        reference,
        route,
        resource,
        parsed,
        config,
        pendingFiles,
        context?.onDemand ?? false,
        policy,
        context?.watch ?? false,
      );
      if (result.violation) {
        invalid.add(route);
        violations.push(`${route}: ${result.violation}`);
      }
      if (result.target) {
        edges.push(result.target);
        if (!queued.has(result.target)) {
          queued.add(result.target);
          queue.push(result.target);
        }
      }
    }
    references.set(route, edges);
  }
  if (violations.length && !recovery)
    throw new MoklyError(
      "build-invalid",
      `document links and resources are invalid:\n${violations
        .sort()
        .map((item) => `- ${item}`)
        .join("\n")}`,
    );
  return {
    closure: new Set([...closure].sort()),
    references,
    locations,
    invalid,
  };
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
  policy: PublicFilePolicy,
  watch: boolean,
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
    if (item.checkFragment && (watch || (onDemand && !reference.includes("#"))))
      return {};
  } else {
    const decision = policy.inspect(target);
    if (decision.kind === "private")
      return {
        target,
        violation: `protected target ${reference}: ${decision.reason}`,
      };
    if (decision.kind === "missing")
      return { target, violation: `missing target ${reference}` };
  }
  const resource =
    parsed.get(target) ?? loadPublicResource(target, pending, policy, config);
  if (!resource) return { violation: `missing target ${reference}` };
  parsed.set(target, resource);
  const violation = item.checkFragment
    ? fragmentViolation(reference, resource.anchors)
    : undefined;
  if (violation) return { violation };
  return onDemand && item.checkFragment && generated !== undefined
    ? {}
    : { target };
}
