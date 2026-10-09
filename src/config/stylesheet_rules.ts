import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { isGeneratedRoute } from "../build/styles/routes.js";
import { MoklyError } from "../errors.js";

import { componentStylesheets } from "./component_stylesheets.js";
import { validateRelativeRoute } from "./paths.js";
import { requireString } from "./rules.js";
import type { ResolvedStylesheetRule, StylesheetRule } from "./types.js";

/** Validate ordered route-to-stylesheet rules. */
export function validateStylesheets(
  rules: readonly StylesheetRule[],
): ResolvedStylesheetRule[] {
  if (!Array.isArray(rules)) {
    throw new MoklyError("config-invalid", "stylesheets must be an array");
  }
  const seen = new Set<string>();
  return rules.map((rawRule, index) => {
    if (!record(rawRule)) {
      throw new MoklyError(
        "config-invalid",
        `stylesheets[${index}] must be an object`,
      );
    }
    const rule = rawRule as unknown as StylesheetRule;
    requireString(rule.match, `stylesheets[${index}].match`);
    if (seen.has(rule.match)) {
      throw new MoklyError(
        "config-invalid",
        `duplicate stylesheet match: ${rule.match}`,
      );
    }
    seen.add(rule.match);
    if (!Array.isArray(rule.stylesheets)) {
      throw new MoklyError(
        "config-invalid",
        `stylesheets[${index}].stylesheets must be an array`,
      );
    }
    const normalized: StylesheetRule = {
      match: rule.match,
      stylesheets: validateStylesheetPaths(
        rule.stylesheets,
        `stylesheets[${index}] path`,
        index,
        "stylesheets",
        true,
      ),
      ...(rule.lightStylesheets !== undefined
        ? {
            lightStylesheets: validateOptionalStylesheetPaths(
              rule.lightStylesheets,
              index,
              "lightStylesheets",
            ),
          }
        : {}),
      ...(rule.darkStylesheets !== undefined
        ? {
            darkStylesheets: validateOptionalStylesheetPaths(
              rule.darkStylesheets,
              index,
              "darkStylesheets",
            ),
          }
        : {}),
    };
    validateRuleStylesheetLinks(normalized, index);
    const componentPosition =
      normalized.stylesheets.indexOf(componentStylesheets);
    return {
      ...normalized,
      ...(componentPosition < 0 ? {} : { componentPosition }),
      stylesheets: normalized.stylesheets.filter(
        (file): file is string => file !== componentStylesheets,
      ),
    };
  });
}

function validateOptionalStylesheetPaths(
  value: unknown,
  index: number,
  field: "darkStylesheets" | "lightStylesheets",
): string[] {
  if (!Array.isArray(value)) {
    throw new MoklyError(
      "config-invalid",
      `stylesheets[${index}].${field} must be an array`,
    );
  }
  return validateStylesheetPaths(
    value,
    `stylesheets[${index}].${field} path`,
    index,
    field,
  );
}

/**
 * Reject stylesheet paths one rule would link twice into a single fragment.
 * Every fragment links the shared list followed by the list for its own scheme,
 * so a path repeated inside one list, or shared by the common list and a
 * per-scheme list, double-links; the same path in both per-scheme lists is fine
 * because no fragment links both. Separate rules may reuse a path freely.
 */
function validateRuleStylesheetLinks(
  rule: StylesheetRule,
  index: number,
): void {
  validateUniqueStylesheetPaths([], rule.stylesheets, index, "stylesheets");
  validateUniqueStylesheetPaths(
    rule.stylesheets,
    rule.lightStylesheets ?? [],
    index,
    "lightStylesheets",
  );
  validateUniqueStylesheetPaths(
    rule.stylesheets,
    rule.darkStylesheets ?? [],
    index,
    "darkStylesheets",
  );
}

function validateStylesheetPaths(
  value: unknown[],
  label: string,
  index: number,
  field: "lightStylesheets" | "darkStylesheets",
): string[];
function validateStylesheetPaths(
  value: unknown[],
  label: string,
  index: number,
  field: "stylesheets",
  marker: true,
): (string | typeof componentStylesheets)[];
function validateStylesheetPaths(
  value: unknown[],
  label: string,
  index: number,
  field: "stylesheets" | "lightStylesheets" | "darkStylesheets",
  marker = false,
): (string | typeof componentStylesheets)[] {
  return value.map((stylesheet) => {
    if (stylesheet === componentStylesheets) {
      if (marker) return componentStylesheets;
      throw new MoklyError(
        "config-invalid",
        `${label}: componentStylesheets belongs only in the shared stylesheets list`,
      );
    }
    requireString(stylesheet, label);
    const normalized = /^https?:\/\//.test(stylesheet)
      ? stylesheet
      : validateRelativeRoute(stylesheet, label);
    if (isGeneratedRoute(normalized))
      throw new MoklyError(
        "config-invalid",
        `stylesheets[${index}].${field} must not reference ${GENERATED_DIRECTORY}/: ${normalized}; link imported CSS through the renderer instead`,
      );
    return normalized;
  });
}

function validateUniqueStylesheetPaths(
  linked: readonly (string | typeof componentStylesheets)[],
  paths: readonly (string | typeof componentStylesheets)[],
  index: number,
  field: "darkStylesheets" | "lightStylesheets" | "stylesheets",
): void {
  const seen = new Set(linked);
  for (const stylesheet of paths) {
    if (seen.has(stylesheet)) {
      throw new MoklyError(
        "config-invalid",
        stylesheet === componentStylesheets
          ? `componentStylesheets may appear only once in stylesheets[${index}].stylesheets`
          : `duplicate stylesheet path in stylesheets[${index}].${field}: ${stylesheet}`,
      );
    }
    seen.add(stylesheet);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
