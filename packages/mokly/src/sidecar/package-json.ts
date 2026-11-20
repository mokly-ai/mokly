/** A manifest object keeps property order and repeated values for resolution evidence. */
export class PackageJson {
  private folderExports: boolean | undefined;

  constructor(readonly entries: Array<[string, unknown]>) {}

  get folderExportsPossible(): boolean {
    return (this.folderExports ??= this.values("exports").some((value) =>
      folderKeys(value),
    ));
  }

  values(key: string): unknown[] {
    return this.entries
      .filter(([name]) => name === key)
      .map(([, value]) => value);
  }
}

export function packageFolderKey(key: string): boolean {
  return key.endsWith("/") && !key.includes("*");
}

function folderKeys(value: unknown, depth = 0): boolean {
  if (depth > 32) return true;
  if (value instanceof PackageJson)
    return value.entries.some(
      ([key, target]) =>
        ((key.startsWith(".") || key.startsWith("#")) &&
          packageFolderKey(key)) ||
        folderKeys(target, depth + 1),
    );
  if (Array.isArray(value))
    return value.some((item) => folderKeys(item, depth + 1));
  return value !== undefined && value !== null && typeof value !== "string";
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
