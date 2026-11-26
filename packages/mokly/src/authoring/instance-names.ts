const defaultNameProps = ["id", "name", "data-testid", "aria-label"];

export function resolveInstanceId(
  segment: string,
  seen: ReadonlySet<string>,
  key: unknown,
  props: Record<string, unknown>,
  namingProps: readonly string[] = defaultNameProps,
): { id: string; numbered: boolean } {
  let name = normalizeName(key);
  for (const prop of namingProps) {
    if (name) break;
    if (prop && prop !== "key" && Object.hasOwn(props, prop))
      name = normalizeName(props[prop]);
  }
  return numberInstanceId(namedId(segment, name), seen);
}

export function resolveWrapperInstanceId(
  segment: string,
  seen: ReadonlySet<string>,
  explicit: unknown,
  key: unknown,
): { id: string; numbered: boolean } {
  const base = explicit ?? namedId(segment, normalizeName(key));
  if (
    typeof base !== "string" ||
    (explicit != null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(base))
  )
    throw new Error("moklyInstance must be lowercase kebab-case");
  return numberInstanceId(base, seen);
}

function namedId(segment: string, name: string): string {
  return name ? `${segment}-${name}` : segment;
}

function numberInstanceId(
  base: string,
  seen: ReadonlySet<string>,
): { id: string; numbered: boolean } {
  let id = base;
  for (let number = 2; seen.has(id); number += 1) id = `${base}-${number}`;
  return { id, numbered: id !== base };
}

function normalizeName(value: unknown): string {
  if (
    typeof value !== "string" &&
    !(typeof value === "number" && Number.isFinite(value))
  )
    return "";
  return String(value)
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}
