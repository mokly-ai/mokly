import {
  isWindowsDeviceName,
  isEntryPath,
  isSafeRepositoryPath,
} from "../navigation/logical.js";

const PORTABLE_URL_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._~-]*$/;

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

/** Return whether every path segment is portable and URL-unreserved. */
export function isPortableUrlPath(value: string): boolean {
  return (
    isSafeRepositoryPath(value) &&
    value.split("/").every((segment) => {
      const stem = segment.split(".", 1)[0] ?? "";
      return (
        PORTABLE_URL_SEGMENT.test(segment) &&
        !segment.endsWith(".") &&
        !isWindowsDeviceName(stem)
      );
    })
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
