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
  const base = name ? `${segment}-${name}` : segment;
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
