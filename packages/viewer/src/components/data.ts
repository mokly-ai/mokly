/** Limits shared by every component schema and complete input value. */
export class DataBudget {
  private nodes = 0;
  constructor(private readonly depthLimit = 64) {}
  visit(depth: number, at: string): void {
    if (depth > this.depthLimit || ++this.nodes > 10_000)
      invalidData(at, "validation limit exceeded");
  }
}

export class ComponentValidationError extends Error {
  constructor(
    readonly path: string,
    readonly detail: string,
  ) {
    super(`[mokly/components] ${path}: ${detail}`);
    this.name = "ComponentValidationError";
  }
}

export function invalidData(at: string, message: string): never {
  throw new ComponentValidationError(at, message);
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Inspect descriptors before reading values; never execute author getters. */
export function plainKeys(
  value: unknown,
  at: string,
  allowReservedKeys = false,
): string[] {
  if (
    !record(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    invalidData(at, "expected a plain object");
  const keys: string[] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") invalidData(at, "symbol keys are unsupported");
    if (
      !allowReservedKeys &&
      ["__proto__", "constructor", "prototype"].includes(key)
    )
      invalidData(`${at}.${key}`, "reserved property name");
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !("value" in descriptor))
      invalidData(
        `${at}.${key}`,
        "only enumerable data properties are supported",
      );
    keys.push(key);
  }
  return keys.sort();
}

export function denseArray(
  value: unknown,
  at: string,
): asserts value is unknown[] {
  if (!Array.isArray(value)) invalidData(at, "expected an array");
  if (Reflect.ownKeys(value).length !== value.length + 1)
    invalidData(at, "expected a dense array without extra properties");
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor))
      invalidData(`${at}[${i}]`, "expected an array data element");
  }
}

/** Validate acyclic plain data before schema-specific access or cloning. */
export function assertPlainData(
  value: unknown,
  at = "$",
  allowUndefined = false,
  depthLimit = 64,
): void {
  const budget = new DataBudget(depthLimit);
  const ancestors = new Set<object>();
  function visit(
    item: unknown,
    location: string,
    depth: number,
    optional: boolean,
  ): void {
    budget.visit(depth, location);
    if (item === undefined && optional) return;
    if (item === null || typeof item === "string" || typeof item === "boolean")
      return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || item === null)
      invalidData(location, "unsupported data value");
    if (ancestors.has(item))
      invalidData(location, "cyclic data is unsupported");
    ancestors.add(item);
    if (Array.isArray(item)) {
      denseArray(item, location);
      item.forEach((child, i) =>
        visit(child, `${location}[${i}]`, depth + 1, false),
      );
    } else {
      for (const key of plainKeys(item, location))
        visit(
          (item as Record<string, unknown>)[key],
          `${location}.${key}`,
          depth + 1,
          allowUndefined,
        );
    }
    ancestors.delete(item);
  }
  visit(value, at, 0, false);
}
