/**
 * Query strings, read and edited without the address. Every edit keeps the
 * pairs it does not touch byte for byte, because a reader's own query must
 * survive each surface that writes only its own keys.
 */

function queryKey(pair: string): string | undefined {
  const separator = pair.indexOf("=");
  const raw = separator === -1 ? pair : pair.slice(0, separator);
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return undefined;
  }
}

function queryPairs(search: string): string[] {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return query.length === 0 ? [] : query.split("&");
}

/** Remove named query pairs without decoding or serializing every other pair. */
export function removeQueryKeys(search: string, removed: ReadonlySet<string>) {
  return queryPairs(search)
    .filter((pair) => {
      const key = queryKey(pair);
      return key === undefined || !removed.has(key);
    })
    .join("&");
}

/** Set one query value in place while retaining every unrelated pair exactly. */
export function setQueryValue(
  search: string,
  key: string,
  value: string,
): string {
  const pair = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  const result: string[] = [];
  let replaced = false;
  for (const current of queryPairs(search)) {
    if (queryKey(current) !== key) {
      result.push(current);
      continue;
    }
    if (!replaced) result.push(pair);
    replaced = true;
  }
  if (!replaced) result.push(pair);
  return result.join("&");
}

/** One route's query, where a repeated key is the array it was written as. */
export type Query = Record<string, string | string[] | undefined>;

/** The address bar's query keys, keeping a repeated key as the array it is. */
export function readQuery(search: string): Query {
  const parameters = new URLSearchParams(search);
  const query: Query = {};
  for (const key of parameters.keys()) {
    const values = parameters.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return query;
}
