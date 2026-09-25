import path from "node:path";

import { isPortableUrlPath } from "@mokly/viewer/data";

import { toPosixPath } from "../../config/paths.js";
import { MoklyError } from "../../errors.js";

/** The only directory beneath mockupsDir owned in its entirety by Mokly. */
export const GENERATED_DIRECTORY = "mokly-generated";

/** The MIME type for every supported opaque CSS asset extension. */
export const ASSET_MIME_TYPES: ReadonlyMap<string, string> = new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".ico", "image/vnd.microsoft.icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".eot", "application/vnd.ms-fontobject"],
  [".otf", "font/otf"],
  [".ttf", "font/ttf"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

/** Extensions delivered as opaque bytes when referenced by imported CSS. */
export const ASSET_EXTENSIONS: ReadonlySet<string> = new Set(
  ASSET_MIME_TYPES.keys(),
);

/** Does a mockups-relative path fall inside the package-owned output tree? */
export function isGeneratedRoute(route: string): boolean {
  return (
    route === GENERATED_DIRECTORY || route.startsWith(`${GENERATED_DIRECTORY}/`)
  );
}

/** Is a path portable, with npm scopes allowed only immediately after node_modules? */
export function isPortableGeneratedPath(value: string): boolean {
  if (!value.split("/").some((part) => part.startsWith("@")))
    return isPortableUrlPath(value);
  const parts = value.split("/");
  return parts.every((part, index) =>
    part.startsWith("@")
      ? index > 0 &&
        parts[index - 1] === "node_modules" &&
        isPortableUrlPath(part.slice(1)) &&
        /^@[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(part)
      : isPortableUrlPath(part),
  );
}

/** Map a repository-relative root module to its deterministic stylesheet route. */
export function stylesheetRoute(root: string, repoRoot: string): string {
  const relative = toPosixPath(path.relative(repoRoot, root));
  const route = `${GENERATED_DIRECTORY}/styles/${relative}.css`;
  if (!isPortableGeneratedPath(relative))
    throw new MoklyError(
      "build-invalid",
      `generated stylesheet route is not portable: ${route}; rename the root module so every path segment is URL-safe`,
    );
  return route;
}

/** Map a repository-relative CSS asset to its deterministic public route. */
export function assetRoute(file: string, repoRoot: string): string {
  const relative = toPosixPath(path.relative(repoRoot, file));
  if (!isPortableGeneratedPath(relative))
    throw new MoklyError(
      "build-invalid",
      `CSS asset route is not portable: ${relative}; rename every path segment to be URL-safe (letters, digits, dot, underscore, tilde or hyphen; @scope only after node_modules; no spaces or device names)`,
    );
  return `${GENERATED_DIRECTORY}/assets/${relative}`;
}

/** Accept only documented CSS or asset output shapes in the reserved tree. */
export function isValidGeneratedRoute(route: string): boolean {
  const stylePrefix = `${GENERATED_DIRECTORY}/styles/`;
  const assetPrefix = `${GENERATED_DIRECTORY}/assets/`;
  if (route.startsWith(stylePrefix)) {
    const relative = route.slice(stylePrefix.length);
    return relative.endsWith(".css") && isPortableGeneratedPath(relative);
  }
  if (route.startsWith(assetPrefix)) {
    const relative = route.slice(assetPrefix.length);
    return (
      isPortableGeneratedPath(relative) &&
      ASSET_EXTENSIONS.has(path.posix.extname(relative))
    );
  }
  return false;
}

/** Admit only portable stylesheet/asset routes from an accepted generation. */
export function isPublicGeneratedRoute(
  route: string,
  accepted?: ReadonlySet<string>,
): boolean {
  return (
    isValidGeneratedRoute(route) &&
    (accepted === undefined || accepted.has(route))
  );
}
