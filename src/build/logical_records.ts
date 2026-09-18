import { parse } from "parse5";

import {
  componentFragmentRoute,
  duplicateReservedAttributeName,
  type HtmlSourceLocation,
  effectiveColorSchemes,
  VIEWPORTS,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import { extractHtmlReferences } from "../html_references.js";
import { fragmentRoute } from "../registry/manifest.js";

import {
  logicalNamespace,
  nativeLinkClass,
  type LogicalReferenceRecord,
  type LogicalNamespace,
  type LogicalOwnerClass,
} from "./logical_record_types.js";

interface HtmlAttribute {
  name: string;
  value: string;
}

interface HtmlNode {
  attrs?: HtmlAttribute[];
  childNodes?: HtmlNode[];
  content?: HtmlNode;
  namespaceURI?: string;
  sourceCodeLocation?: {
    startTag?: HtmlSourceLocation;
  } | null;
  tagName?: string;
}

interface ParsedNode {
  attributes: ReadonlyMap<string, string>;
  marker?: string;
  namespace: LogicalNamespace;
  ownerClass: LogicalOwnerClass;
}

/** Validate that compatibility transformation retained every logical record. */
export function validateCompatibilityRecords(
  route: string,
  content: string,
  expected: readonly LogicalReferenceRecord[],
): void {
  const nodes: ParsedNode[] = [];
  let hasBaseHref = false;
  const document = parse(content, {
    sourceCodeLocationInfo: true,
  }) as unknown as HtmlNode;
  visit(document, (node) => {
    const duplicate = duplicateReservedAttributeName(
      content,
      node.sourceCodeLocation?.startTag,
    );
    if (duplicate) {
      throw new MoklyError(
        "build-invalid",
        `${route} contains duplicate reserved ${duplicate} metadata after compatibility transform`,
      );
    }
    const attributes = new Map(
      (node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]),
    );
    if (node.tagName === "base" && attributes.has("href")) hasBaseHref = true;
    const namespace = logicalNamespace(node.namespaceURI);
    const marker = attributes.get("data-mokly-link");
    nodes.push({
      attributes,
      ...(marker === undefined ? {} : { marker }),
      namespace,
      ownerClass: nativeLinkClass(node.tagName, namespace) ?? "metadata-only",
    });
  });
  if (hasBaseHref && expected.some((record) => record.marker)) {
    throw new MoklyError(
      "build-invalid",
      `${route} contains base href with an activatable logical link after compatibility transform`,
    );
  }
  const expectedMarked = expected.filter(
    (record): record is LogicalReferenceRecord & { marker: string } =>
      record.marker !== undefined,
  );
  const unmatchedMarked = nodes.filter((node) => node.marker !== undefined);
  for (const record of expectedMarked) {
    const index = unmatchedMarked.findIndex((node) => matches(node, record));
    if (index < 0) throw divergence(route);
    unmatchedMarked.splice(index, 1);
  }
  if (unmatchedMarked.length > 0) throw divergence(route);

  const metadataGroups = groupMetadataRecords(expected);
  for (const { count, record } of metadataGroups.values()) {
    const actualCount = nodes.filter(
      (node) => node.marker === undefined && matches(node, record),
    ).length;
    if (actualCount !== count) throw divergence(route);
  }
}

/** Validate every logical fragment against all destination artifacts. */
export function validateLogicalFragments(
  outputs: ReadonlyMap<string, string>,
  records: readonly LogicalReferenceRecord[],
  entries: readonly ResolvedRegistryEntry[],
  config: ResolvedConfig,
  anchorsFor?: (route: string) => ReadonlySet<string> | undefined,
): void {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const anchorIndex = new Map<string, ReadonlySet<string>>();
  const anchors =
    anchorsFor ??
    ((route: string) => {
      if (!anchorIndex.has(route)) {
        const content = outputs.get(route);
        if (content !== undefined)
          anchorIndex.set(route, extractHtmlReferences(content).anchors);
      }
      return anchorIndex.get(route);
    });
  const checked = new Set<string>();
  for (const record of records) {
    const fragment = record.destination.fragment;
    if (!fragment) continue;
    const key = `${record.destination.id}#${fragment}`;
    if (checked.has(key)) continue;
    checked.add(key);
    const entry = byId.get(record.destination.id);
    if (entry?.kind === "page") {
      if (!anchors(entry.route)?.has(fragment))
        throw new MoklyError(
          "build-invalid",
          `${record.sourceRoute} logical fragment ${fragment} for ${entry.id} is missing from page ${entry.route}`,
        );
      continue;
    }
    const screen =
      entry?.kind === "screen" || entry?.kind === "component"
        ? entry
        : entry?.kind === "use-case" && entry.steps[0]
          ? byId.get(entry.steps[0].screenId)
          : undefined;
    if (screen?.kind !== "screen" && screen?.kind !== "component") continue;
    for (const viewport of VIEWPORTS) {
      for (const scheme of effectiveColorSchemes(screen, config.colorSchemes)) {
        const route =
          screen.kind === "component"
            ? componentFragmentRoute(
                screen.route,
                screen.variants[0]!.id,
                viewport,
                scheme,
              )
            : fragmentRoute(screen.route, viewport, scheme);
        if (!anchors(route)?.has(fragment)) {
          throw new MoklyError(
            "build-invalid",
            `${record.sourceRoute} logical fragment ${fragment} for ${record.destination.id} is missing from ${viewport} ${scheme} view ${route}`,
          );
        }
      }
    }
  }
}

function matches(node: ParsedNode, record: LogicalReferenceRecord): boolean {
  return (
    node.marker === record.marker &&
    node.namespace === record.namespace &&
    node.ownerClass === record.ownerClass &&
    record.attributes.every(
      (attribute) => node.attributes.get(attribute.name) === attribute.value,
    )
  );
}

function groupMetadataRecords(
  records: readonly LogicalReferenceRecord[],
): Map<string, { count: number; record: LogicalReferenceRecord }> {
  const groups = new Map<
    string,
    { count: number; record: LogicalReferenceRecord }
  >();
  for (const record of records) {
    if (record.marker) continue;
    const key = JSON.stringify([
      record.namespace,
      record.ownerClass,
      record.attributes,
    ]);
    const group = groups.get(key);
    groups.set(key, { count: (group?.count ?? 0) + 1, record });
  }
  return groups;
}

function divergence(route: string): MoklyError {
  return new MoklyError(
    "build-invalid",
    `compatibility transform changed a logical-reference record in ${route}`,
  );
}

function visit(node: HtmlNode, callback: (node: HtmlNode) => void): void {
  callback(node);
  for (const child of node.childNodes ?? []) visit(child, callback);
  if (node.content) visit(node.content, callback);
}
