/** Read exactly one non-empty value from provider-controlled URL parameters. */
export function one(params: URLSearchParams, name: string): string | undefined {
  const values = params.getAll(name);
  return values.length === 1 && values[0].length > 0 ? values[0] : undefined;
}
