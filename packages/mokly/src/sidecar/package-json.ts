/** A manifest object keeps property order and repeated values for resolution evidence. */
export class PackageJson {
  constructor(readonly entries: Array<[string, unknown]>) {}

  values(key: string): unknown[] {
    return this.entries
      .filter(([name]) => name === key)
      .map(([, value]) => value);
  }
}

/** Validate package JSON, then retain strings and package maps without last-key-wins loss. */
export function parsePackageJson(
  text: string,
  fields: string[] = [],
  allowNonObject = false,
): PackageJson {
  text = text.replace(/^\uFEFF/, "");
  const validated: unknown = JSON.parse(text);
  if (!validated || typeof validated !== "object" || Array.isArray(validated)) {
    if (allowNonObject) return new PackageJson([]);
    throw new Error("package manifest must be an object");
  }
  const tokens = text.matchAll(
    /"(?:\\[\s\S]|[^"\\])*"|[{}[\],:]|[^\s{}[\],:]+/g,
  );
  let token = tokens.next().value?.[0];
  const next = () => {
    token = tokens.next().value?.[0];
  };
  const peek = () => token;
  const skip = () => {
    let depth = 0;
    do {
      if (token === "{" || token === "[") depth++;
      else if (token === "}" || token === "]") depth--;
      next();
    } while (depth > 0);
  };
  const read = (depth: number): unknown => {
    if (peek() === "{") {
      const entries: Array<[string, unknown]> = [];
      next();
      while (token !== "}") {
        const key: unknown = JSON.parse(token!);
        if (typeof key !== "string") throw new Error("invalid package key");
        next();
        next();
        if (
          depth > 0 ||
          token?.startsWith('"') ||
          key === "exports" ||
          key === "imports" ||
          fields.includes(key)
        )
          entries.push([key, read(depth + 1)]);
        else skip();
        if (token === ",") next();
      }
      next();
      return new PackageJson(entries);
    }
    if (peek() === "[") {
      const items: unknown[] = [];
      next();
      while (token !== "]") {
        items.push(read(depth + 1));
        if (token === ",") next();
      }
      next();
      return items;
    }
    const value: unknown = JSON.parse(token!);
    next();
    return value;
  };
  const manifest = read(0);
  if (!(manifest instanceof PackageJson))
    throw new Error("invalid package manifest");
  return manifest;
}
