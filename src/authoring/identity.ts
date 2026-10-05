import { DEFINITION, DEFINITION_IDENTITY } from "./markers.js";
import type {
  DefinitionBrand,
  EntryDefinition,
  RegistryDefinition,
} from "./types.js";

const references = new Map<string, EntryDefinition>();
const ORIGINAL = Symbol.for("mokly.original-definition");
const REFERENCES = Symbol.for("mokly.definition-references");
const REFERENCE = Symbol.for("mokly.definition-reference");

/** Recognize definitions across consumer-bundle boundaries. */
export function isDefinition(value: unknown): value is RegistryDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    DEFINITION in value &&
    value[DEFINITION] === true
  );
}

type DefinitionIdentity = DefinitionBrand[typeof DEFINITION_IDENTITY] & {
  [ORIGINAL]?: object;
  [REFERENCE]?: string;
  [REFERENCES]?: ReadonlyMap<string, EntryDefinition>;
};

/** Retain the exact helper-returned object across the consumer bundle boundary. */
export function registerDefinition<T extends DefinitionBrand>(
  definition: T,
): T {
  const identity = definition[DEFINITION_IDENTITY] as DefinitionIdentity;
  identity[ORIGINAL] ??= definition;
  identity[REFERENCES] ??= references;
  return definition;
}

/** Copies of a branded object are not helper-created definitions. */
export function isRegisteredDefinition(value: RegistryDefinition): boolean {
  return (
    (value[DEFINITION_IDENTITY] as DefinitionIdentity | undefined)?.[
      ORIGINAL
    ] === value
  );
}

/** Read a capability allocated by the same consumer graph's link helper. */
export function referencedDefinition(
  token: string,
  entry: EntryDefinition,
): EntryDefinition | undefined {
  return (entry[DEFINITION_IDENTITY] as DefinitionIdentity)[REFERENCES]?.get(
    token,
  );
}

/** Stable, unguessable capability for a link created before path resolution. */
export function definitionReference(definition: EntryDefinition): string {
  if (!isRegisteredDefinition(definition))
    throw new TypeError(
      "mockLink expected a definition returned by a define helper",
    );
  const identity = definition[DEFINITION_IDENTITY] as DefinitionIdentity;
  if (identity.path !== undefined) return identity.path;
  if (identity[REFERENCE] === undefined) {
    identity[REFERENCE] = `~definition-${referenceToken()}`;
    references.set(identity[REFERENCE], definition);
  }
  return identity[REFERENCE];
}

/** Keep the private token syntax on browser origins without randomUUID. */
function referenceToken(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/** Read only an allocated reference; registry preparation never invents one. */
export function existingDefinitionReference(
  definition: EntryDefinition,
): string | undefined {
  return (definition[DEFINITION_IDENTITY] as { [REFERENCE]?: string })[
    REFERENCE
  ];
}

/** Resolve a component wrapper's path after registry preparation. */
export function definitionPath(definition: EntryDefinition): string {
  const path = definition[DEFINITION_IDENTITY].path;
  if (path === undefined)
    throw new Error("component definition is not exported in the registry");
  return path;
}

/** Resolve the registered slug used as the default local instance id. */
export function definitionSlug(definition: EntryDefinition): string {
  const slug = definition[DEFINITION_IDENTITY].slug;
  if (slug === undefined)
    throw new Error("component definition is not exported in the registry");
  return slug;
}
