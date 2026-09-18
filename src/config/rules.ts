import type { ColorScheme } from "@mokly/viewer";

import { MoklyError } from "../errors.js";

import { validateRelativeRoute } from "./paths.js";
import type { StylesheetRule, WatchRule } from "./types.js";

const WATCH_ACTIONS = new Set(["ignore", "rebuild", "reload", "restart"]);

/** Validate and normalize the configured color-scheme rendering targets. */
export function validateColorSchemes(value: unknown): ColorScheme[] {
  if (value === undefined) return ["light"];
  if (!Array.isArray(value) || value.length === 0) {
    throw new MoklyError(
      "config-invalid",
      "colorSchemes must be a non-empty array",
    );
  }
  const schemes = new Set<ColorScheme>();
  for (const scheme of value) {
    if (scheme !== "light" && scheme !== "dark") {
      throw new MoklyError(
        "config-invalid",
        `colorSchemes contains an unknown value: ${String(scheme)}`,
      );
    }
    if (schemes.has(scheme)) {
      throw new MoklyError(
        "config-invalid",
        `duplicate colorSchemes value: ${scheme}`,
      );
    }
    schemes.add(scheme);
  }
  if (!schemes.has("light")) {
    throw new MoklyError("config-invalid", 'colorSchemes must include "light"');
  }
  return schemes.has("dark") ? ["light", "dark"] : ["light"];
}

/** Validate ordered route-to-stylesheet rules. */
export function validateStylesheets(
  rules: readonly StylesheetRule[],
): StylesheetRule[] {
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
    return normalized;
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
  return validateStylesheetPaths(value, `stylesheets[${index}].${field} path`);
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

function validateStylesheetPaths(value: unknown[], label: string): string[] {
  return value.map((stylesheet) => {
    requireString(stylesheet, label);
    return /^https?:\/\//.test(stylesheet)
      ? stylesheet
      : validateRelativeRoute(stylesheet, label);
  });
}

function validateUniqueStylesheetPaths(
  linked: readonly string[],
  paths: readonly string[],
  index: number,
  field: "darkStylesheets" | "lightStylesheets" | "stylesheets",
): void {
  const seen = new Set(linked);
  for (const stylesheet of paths) {
    if (seen.has(stylesheet)) {
      throw new MoklyError(
        "config-invalid",
        `duplicate stylesheet path in stylesheets[${index}].${field}: ${stylesheet}`,
      );
    }
    seen.add(stylesheet);
  }
}

/** Validate explicit watch classifications and reject ambiguity. */
export function validateWatchRules(rules: readonly WatchRule[]): WatchRule[] {
  if (!Array.isArray(rules)) {
    throw new MoklyError("config-invalid", "watch.rules must be an array");
  }
  const seen = new Set<string>();
  return rules.map((rawRule, index) => {
    if (!record(rawRule)) {
      throw new MoklyError(
        "config-invalid",
        `watch.rules[${index}] must be an object`,
      );
    }
    const rule = rawRule as unknown as WatchRule;
    if (!WATCH_ACTIONS.has(rule.action)) {
      throw new MoklyError(
        "config-invalid",
        `watch.rules[${index}] has invalid action`,
      );
    }
    if (!Array.isArray(rule.paths) || rule.paths.length === 0) {
      throw new MoklyError(
        "config-invalid",
        `watch.rules[${index}].paths must not be empty`,
      );
    }
    const paths = rule.paths.map((glob: string) => {
      requireString(glob, `watch.rules[${index}] path`);
      return validateRelativeRoute(glob, `watch.rules[${index}] path`);
    });
    for (const glob of paths) {
      if (seen.has(glob)) {
        throw new MoklyError("config-invalid", `duplicate watch path: ${glob}`);
      }
      seen.add(glob);
    }
    return { action: rule.action, paths };
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize and bound the watch debounce duration. */
export function validateDebounce(value: number | undefined): number {
  const debounce = value ?? 75;
  if (!Number.isInteger(debounce) || debounce < 0 || debounce > 10_000) {
    throw new MoklyError(
      "config-invalid",
      "watch.debounceMs must be an integer from 0 to 10000",
    );
  }
  return debounce;
}

/** Require a non-empty string while narrowing runtime input. */
export function requireString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MoklyError(
      "config-invalid",
      `${label} must be a non-empty string`,
    );
  }
}

/** Validate a config list whose members must be non-empty strings. */
export function validateStringArray(
  value: readonly string[],
  label: string,
): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string" && item.trim().length > 0)
  ) {
    throw new MoklyError(
      "config-invalid",
      `${label} must be an array of non-empty strings`,
    );
  }
  return [...value];
}
