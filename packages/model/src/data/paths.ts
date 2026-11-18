import { isEntryPath } from "../navigation/logical.js";

/** Return whether a catalogue route is portable as both a path and a URL. */
export function isSafeCatalogueRoute(value: string): boolean {
  const boundary = value.lastIndexOf("/");
  return (
    boundary > 0 &&
    isEntryPath(value.slice(0, boundary)) &&
    /^index(?:\.(?:mobile|desktop))?(?:\.dark)?\.html$/.test(
      value.slice(boundary + 1),
    )
  );
}

/** Percent-encode path segments while retaining their slash hierarchy. */
export function encodeUrlPath(value: string): string {
  return value
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}
