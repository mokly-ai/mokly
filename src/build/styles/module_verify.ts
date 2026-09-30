import postcss, {
  CssSyntaxError,
  type AtRule,
  type ChildNode,
  type Container,
  type Declaration,
  type Root,
  type Rule,
} from "postcss";

import { MoklyError } from "../../errors.js";

import { scanCssText } from "./module_css_scan.js";
import { scanScopePrelude, type ScopeGroup } from "./module_scope.js";
import { moduleSelectorsMatch } from "./module_verify_selector.js";
import {
  scopedWordMatches,
  validModuleIdentifier,
  moduleValuesMatch,
} from "./module_verify_value.js";

/** Reject any CSS Modules output difference beyond documented local-name edits. */
export function verifyModuleScoping(
  input: string,
  output: string,
  relative: string,
  prefix: string,
): void {
  const original = postcss.parse(input, { from: relative, map: false });
  original.walkDecls((declaration) => {
    if (["composes", "compose-with"].includes(declaration.prop.toLowerCase()))
      declaration.remove();
  });
  let transformed: Root;
  try {
    transformed = postcss.parse(output, { from: relative, map: false });
  } catch (error) {
    const line = error instanceof CssSyntaxError ? error.line : undefined;
    const matching =
      line === undefined
        ? undefined
        : original.nodes.find((node) => node.source?.start?.line === line);
    throw changed(relative, matching ?? original.first ?? original);
  }
  const first = firstDifference(original, transformed, prefix);
  if (first) throw changed(relative, first);
}

function changed(relative: string, node: Root | ChildNode): MoklyError {
  const start = node.source?.start;
  return new MoklyError(
    "build-invalid",
    `CSS Modules scoping would change more than local names in ${relative}:${start?.line ?? 1}:${start?.column ?? 1}; move this CSS to a plain stylesheet`,
  );
}

function firstDifference(
  input: Root | ChildNode,
  output: Root | ChildNode,
  prefix: string,
): ChildNode | undefined {
  if (input.type !== output.type) return input as ChildNode;
  switch (input.type) {
    case "comment":
      if (input.text !== (output as typeof input).text) return input;
      break;
    case "decl": {
      const changed = output as Declaration;
      if (
        input.prop !== changed.prop ||
        input.important !== changed.important ||
        !moduleValuesMatch(input.value, changed.value, prefix)
      )
        return input;
      break;
    }
    case "rule": {
      const changed = output as Rule;
      // The plugins saw PostCSS's cleaned input; compare it with the exact output that ships.
      if (
        !moduleSelectorsMatch(
          input.selector,
          shippedText(changed.selector, changed.raws.selector),
          prefix,
        )
      )
        return input;
      break;
    }
    case "atrule": {
      const changed = output as AtRule;
      if (
        input.name !== changed.name ||
        !atRuleParamsMatch(input, changed, prefix)
      )
        return input;
      break;
    }
  }
  if ("nodes" in input) {
    const originalChildren = (input as Container).nodes ?? [];
    const changedChildren = (output as Container).nodes ?? [];
    let changedIndex = 0;
    for (let index = 0; index < originalChildren.length; index += 1) {
      const original = originalChildren[index]!;
      while (
        original.type === "rule" &&
        changedChildren[changedIndex]?.type === "comment" &&
        original.selector.includes(changedChildren[changedIndex]!.toString())
      )
        changedIndex += 1;
      const changed = changedChildren[changedIndex];
      if (!changed) return original;
      const first = firstDifference(original, changed, prefix);
      if (first) return first;
      changedIndex += 1;
    }
    if (changedIndex !== changedChildren.length)
      return input.type === "root"
        ? (input.first ?? undefined)
        : (input as ChildNode);
  }
  return;
}

function atRuleParamsMatch(
  input: AtRule,
  output: AtRule,
  prefix: string,
): boolean {
  const outputParams =
    input.name.toLowerCase() === "scope"
      ? shippedText(output.params, output.raws.params)
      : output.params;
  if (input.params === outputParams) return true;
  if (input.name.toLowerCase() === "scope") {
    try {
      const first = scanScopePrelude(input.params);
      const second = scanScopePrelude(outputParams);
      return (
        scopeOutside(input.params, first.start, first.limit) ===
          scopeOutside(outputParams, second.start, second.limit) &&
        scopeGroupMatches(
          input.params,
          first.start,
          outputParams,
          second.start,
          prefix,
        ) &&
        scopeGroupMatches(
          input.params,
          first.limit,
          outputParams,
          second.limit,
          prefix,
        )
      );
    } catch {
      return false;
    }
  }
  if (/keyframes$/iu.test(input.name)) {
    const original = unwrapKeyframe(input.params.trim());
    return (
      original !== undefined &&
      validModuleIdentifier(original) &&
      scopedWordMatches(original, output.params.trim(), prefix)
    );
  }
  return input.params.trim() === output.params.trim();
}

function unwrapKeyframe(value: string): string | undefined {
  const wrapper = /^:(?:global|local)\(([^()]*)\)$/u.exec(value);
  return wrapper ? wrapper[1] : value;
}

function scopeOutside(
  text: string,
  start?: ScopeGroup,
  limit?: ScopeGroup,
): string {
  let result = text;
  for (const group of [start, limit]
    .filter((part): part is ScopeGroup => part !== undefined)
    .sort((left, right) => right.start - left.start))
    result = result.slice(0, group.start) + "\0" + result.slice(group.end);
  const scan = scanCssText(result);
  let withoutComments = "";
  let cursor = 0;
  for (const comment of scan.comments) {
    withoutComments += result.slice(cursor, comment.start);
    cursor = comment.end;
  }
  return withoutComments + result.slice(cursor);
}

function shippedText(cleaned: string, raw: unknown): string {
  if (
    raw &&
    typeof raw === "object" &&
    "raw" in raw &&
    "value" in raw &&
    typeof raw.raw === "string" &&
    raw.value === cleaned
  )
    return raw.raw;
  return cleaned;
}

function scopeGroupMatches(
  input: string,
  original: ScopeGroup | undefined,
  output: string,
  changed: ScopeGroup | undefined,
  prefix: string,
): boolean {
  if (!original || !changed) return original === changed;
  return moduleSelectorsMatch(
    input.slice(original.start, original.end),
    output.slice(changed.start, changed.end),
    prefix,
  );
}
