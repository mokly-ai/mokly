import postcss, { type ChildNode, type Root } from "postcss";
import { parseFragment } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

import type { CollectedStyle } from "../generated/sidecar/CollectedStyle.js";
import type { RenderSession, StyleOwnerRecord } from "../authoring/runtime.js";

type HtmlNode = DefaultTreeAdapterMap["node"];

/** Split existing CSS slices and assign class rules to authenticated owners. */
export function ownedStyles(
  css: string,
  html: string,
  session: RenderSession,
  records: readonly StyleOwnerRecord[] = [],
  usePhysicalOwners = true,
): CollectedStyle[] {
  if (!css) return [];
  const owners = classOwners(html, session);
  let root: Root;
  try {
    root = postcss.parse(css);
  } catch {
    return [{ css, owners: [] }];
  }
  const occurrences = new Map<string, number>();
  const styles = root.nodes.map((node) => ({
    css: node.toString(),
    owners: nodeOwners(node, owners, records, usePhysicalOwners, occurrences),
  }));
  if (styles.length) styles.at(-1)!.css += root.raws.after ?? "";
  else styles.push({ css, owners: [] });
  return styles;
}

function nodeOwners(
  node: ChildNode,
  classes: Map<string, Set<string>>,
  records: readonly StyleOwnerRecord[],
  usePhysicalOwners: boolean,
  occurrences: Map<string, number>,
): string[] {
  const selectors = node.type === "rule" ? [node.selector] : [];
  if (node.type === "atrule" && node.nodes)
    selectors.push(
      ...node.nodes
        .filter(
          (child): child is ChildNode & { type: "rule" } =>
            child.type === "rule",
        )
        .map((child) => child.selector),
    );
  const injected = selectors
    .map((selector) => injectedOwner(selector, records, occurrences))
    .filter((owner): owner is string => owner !== undefined);
  if (injected.length && injected.every((owner) => owner === injected[0]))
    return [injected[0]!];
  if (!usePhysicalOwners) return [];
  const physical = selectors
    .map((selector) => selectorOwner(selector, classes))
    .filter((owner): owner is string => owner !== undefined);
  return physical.length && physical.every((owner) => owner === physical[0])
    ? [physical[0]!]
    : [];
}

function injectedOwner(
  selector: string,
  records: readonly StyleOwnerRecord[],
  occurrences: Map<string, number>,
): string | undefined {
  const normalized = selector.replace(/\s+/g, "").trim();
  const owners: string[] = [];
  for (const record of records) {
    let root: Root;
    try {
      root = postcss.parse(record.css);
    } catch {
      continue;
    }
    root.walkRules((rule) => {
      if (rule.selector.replace(/\s+/g, "").trim() === normalized)
        owners.push(record.owner);
    });
  }
  const occurrence = occurrences.get(normalized) ?? 0;
  occurrences.set(normalized, occurrence + 1);
  return owners[occurrence];
}

function selectorOwner(
  selector: string,
  classes: Map<string, Set<string>>,
): string | undefined {
  const names = [
    ...selector.matchAll(/\.((?:\\(?:[0-9a-f]{1,6}\s?|.)|[\w-])+)/gi),
  ].map((match) => match[1]!);
  if (!names.length) return undefined;
  let candidates: Set<string> | undefined;
  for (const name of names) {
    const found = classes.get(unescape(name));
    if (!found) return undefined;
    candidates = candidates
      ? new Set([...candidates].filter((owner) => found.has(owner)))
      : new Set(found);
  }
  return candidates?.size === 1 ? [...candidates][0] : undefined;
}

function classOwners(
  html: string,
  session: RenderSession,
): Map<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  let stack: (string | undefined)[] = [];
  const visit = (node: HtmlNode) => {
    let next = stack;
    if ("tagName" in node && node.tagName === "template") {
      const token = node.attrs.find(
        (attribute) => attribute.name === "data-mokly-boundary",
      )?.value;
      const comment = token ? session.markers.get(token) : undefined;
      if (comment?.includes(":start "))
        stack = [...stack, ownerFromComment(comment, session)];
      else if (comment?.includes(":end ")) stack = stack.slice(0, -1);
      next = stack;
    }
    if ("attrs" in node) {
      const value = node.attrs.find(
        (attribute) => attribute.name === "class",
      )?.value;
      const owner = next.at(-1);
      if (owner)
        for (const name of value?.split(/\s+/) ?? []) {
          if (!name) continue;
          let values = owners.get(name);
          if (!values) owners.set(name, (values = new Set()));
          values.add(owner);
        }
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("content" in node) node.content.childNodes.forEach(visit);
    stack = next;
  };
  visit(parseFragment(html));
  return owners;
}

function ownerFromComment(
  comment: string,
  session: RenderSession,
): string | undefined {
  const id = /\bid="([^"]+)"/.exec(comment)?.[1];
  if (!id) return undefined;
  if (comment.startsWith("mokly-instance:"))
    return session.instances.find((instance) => instance.regionId === id)
      ?.componentPath;
  if (comment.startsWith("mokly-slot:")) {
    const slot = session.slots.find((value) => value.regionIds.includes(id));
    const owner = slot?.owner;
    if (owner?.kind === "instance")
      return session.instances.find(
        (instance) => instance.key === owner.instanceKey,
      )?.componentPath;
  }
  return undefined;
}

function unescape(value: string): string {
  return value.replace(/\\([0-9a-f]{1,6}\s?|.)/gi, (_, escaped: string) =>
    /^[0-9a-f]/i.test(escaped)
      ? String.fromCodePoint(parseInt(escaped.trim(), 16) || 0xfffd)
      : escaped,
  );
}
