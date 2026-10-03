import type { ColorScheme } from "@mokly/viewer";

import { MoklyError } from "../errors.js";

import { validateRelativeRoute } from "./paths.js";
import type { WatchRule } from "./types.js";

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
