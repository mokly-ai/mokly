import { isCatalogueId, isPortableUrlPath } from "@mokly/viewer/data";

import type { InteractiveBootstrap, InteractiveRoute } from "../types.js";

/** Read and strictly validate the one package-owned Live bootstrap element. */
export function readInteractiveBootstrap(
  document: Document,
): InteractiveBootstrap {
  const elements = document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/json"][data-mokly-interactive]',
  );
  if (elements.length !== 1) throw new Error("Invalid Live bootstrap element.");
  let value: unknown;
  try {
    value = JSON.parse(elements[0]?.textContent ?? "");
  } catch {
    throw new Error("Invalid Live bootstrap JSON.");
  }
  if (!record(value) || !exact(value, bootstrapKeys(value)))
    throw new Error("Invalid Live bootstrap.");
  if (
    !isCatalogueId(value.entryId) ||
    (value.entryKind !== "screen" && value.entryKind !== "component") ||
    (value.viewport !== "mobile" && value.viewport !== "desktop") ||
    (value.colorScheme !== "light" && value.colorScheme !== "dark") ||
    typeof value.generation !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value.generation) ||
    (value.variantId !== undefined && !isCatalogueId(value.variantId)) ||
    (value.entryKind === "component") !== (value.variantId !== undefined) ||
    !record(value.routes)
  )
    throw new Error("Invalid Live bootstrap values.");
  const routes = Object.fromEntries(
    Object.entries(value.routes).map(([id, route]) => {
      if (!isCatalogueId(id)) throw new Error("Invalid Live route id.");
      return [id, readRoute(route)];
    }),
  );
  return { ...value, routes } as InteractiveBootstrap;
}

function readRoute(value: unknown): InteractiveRoute {
  if (!record(value) || !exact(value, ["href"]) || !relativeHref(value.href))
    throw new Error("Invalid Live route.");
  return { href: value.href };
}

function relativeHref(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !/^(?:\.\.\/|\.\/)/.test(value) ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return false;
  const [path] = value.split("#", 1);
  return Boolean(
    path && isPortableUrlPath(path.replace(/^(?:\.\.\/|\.\/)+/, "")),
  );
}

function bootstrapKeys(value: Record<string, unknown>): string[] {
  return [
    "colorScheme",
    "entryId",
    "entryKind",
    "generation",
    "routes",
    "viewport",
    ...(value.variantId === undefined ? [] : ["variantId"]),
  ];
}

function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
