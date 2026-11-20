import { isBuiltin } from "node:module";

export interface LookupRequest {
  kind: "lookup";
  name: string;
  directory: string;
}

type ResolutionRequest = { kind: "plugin" | "builtin" } | LookupRequest;

/** Plugins claim written names; native built-ins follow the effective alias. */
export function resolutionRequest(
  name: string,
  directory: string,
  aliases: ReadonlyArray<readonly [string, string]>,
  aliasDirectory: string,
): ResolutionRequest {
  if (name === "@mokly/mokly" || name.startsWith("mokly:"))
    return { kind: "plugin" };
  const alias = aliases.find(
    ([key]) => name === key || name.startsWith(key + "/"),
  );
  if (alias) {
    const tail = name.slice(alias[0].length);
    name = alias[1] + (tail === "/" ? "" : tail);
    directory = aliasDirectory;
  }
  return isBuiltin(name)
    ? { kind: "builtin" }
    : { kind: "lookup", name, directory };
}
