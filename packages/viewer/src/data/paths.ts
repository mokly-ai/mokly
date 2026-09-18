const PORTABLE_URL_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/;
const WINDOWS_DEVICE = /^(?:aux|con|nul|prn|com[1-9]|lpt[1-9])$/i;

/** Return whether a catalogue route is portable as both a path and a URL. */
export function isSafeCatalogueRoute(value: string): boolean {
  return value.endsWith(".html") && isPortableUrlPath(value);
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
        !WINDOWS_DEVICE.test(stem)
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

/** Return whether a value is a canonical, portable repository-relative path. */
export function isSafeRepositoryPath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes(":") &&
    !value.includes("\0") &&
    !value
      .split("/")
      .some((part) => part === "" || part === "." || part === "..")
  );
}
