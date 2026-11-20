import type { KeyedResource, Resource } from "./use-resource";

/** Hide another key's state synchronously, before a resource effect starts. */
export function resourceForKey<T>(
  key: string,
  held: KeyedResource<T>,
): Resource<T> {
  return held.key === key ? held.state : { status: "loading" };
}
