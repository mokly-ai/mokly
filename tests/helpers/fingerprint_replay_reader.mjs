import { MoklyError } from "../../dist/errors.js";

/** Observe original calls unchanged, then replay their immutable bytes without extra reads. */
export function fingerprintReplayReader(reader) {
  const successful = new Map();
  const required = new Map();
  const optional = new Map();
  const remember = (route, bytes) => {
    if (bytes !== undefined) successful.set(route, Uint8Array.from(bytes));
  };
  const observed = {};
  for (const method of ["read", "readIfExists", "readMany", "readManyIfExists"])
    if (reader[method])
      observed[method] = async (argument) => {
        const result = await reader[method](argument);
        if (method.startsWith("readMany"))
          for (const [route, bytes] of result) remember(route, bytes);
        else remember(argument, result);
        return result;
      };
  const retained = (cache, route, read) => {
    if (successful.has(route)) return Promise.resolve(successful.get(route));
    if (!cache.has(route)) {
      const operation = Promise.resolve().then(() => read(route));
      void operation.catch(() => {});
      cache.set(route, operation);
    }
    return cache.get(route);
  };
  const readIfExists = reader.readIfExists
    ? (route) => reader.readIfExists(route)
    : reader.readManyIfExists
      ? async (route) => {
          const files = await reader.readManyIfExists([route]);
          if (!files.has(route))
            throw new MoklyError(
              "review-invalid",
              `batch reader omitted the file: ${route}`,
            );
          return files.get(route);
        }
      : undefined;
  return {
    observed,
    replay: {
      read: (route) => retained(required, route, (value) => reader.read(value)),
      ...(readIfExists
        ? { readIfExists: (route) => retained(optional, route, readIfExists) }
        : {}),
    },
  };
}
