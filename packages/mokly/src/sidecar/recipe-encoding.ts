const prepared = new WeakMap<object, ReadonlyMap<object, string>>();

export function prepareRecipeEncoding(
  result: object,
  encoding: ReadonlyMap<object, string>,
): void {
  prepared.set(result, encoding);
}

export function takeRecipeEncoding(
  outcome: object,
): ReadonlyMap<object, string> | undefined {
  if (
    !("result" in outcome) ||
    !outcome.result ||
    typeof outcome.result !== "object"
  )
    return undefined;
  const encoding = prepared.get(outcome.result);
  prepared.delete(outcome.result);
  return encoding;
}
