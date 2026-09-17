import { isCatalogueId, isLogicalFragment } from "./logical.js";

/** Exact file URL shared by shell rendering and static logical-id navigation. */
export function catalogueViewHref(route: string): string {
  return `/view/${route.split("/").map(encodeURIComponent).join("/")}`;
}

/** Trusted shell metadata needed to serve a catalogue from ordinary files. */
export interface StaticDelivery {
  schemaVersion: 2;
  deploymentId: string;
  canonicalPath: string;
  idRoutes: Readonly<Record<string, string>>;
  /** Null explicitly disables comparisons for a current-only publication. */
  comparisonUrl: string | null;
}

/** Require an exact same-origin encoded file path beneath a reserved prefix. */
function isViewPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\/view\/(?:[A-Za-z0-9][A-Za-z0-9._~-]*\/)*[A-Za-z0-9][A-Za-z0-9._~-]*\.html$/.test(
      value,
    )
  );
}

/** Validate static metadata before it can authorize browser requests. */
export function parseStaticDelivery(
  value: unknown,
): StaticDelivery | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 2 ||
    !("deploymentId" in value) ||
    typeof value.deploymentId !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.deploymentId) ||
    !("canonicalPath" in value) ||
    !("comparisonUrl" in value) ||
    !("idRoutes" in value)
  )
    return undefined;
  if (
    value.canonicalPath !== "/" &&
    value.canonicalPath !== "/404.html" &&
    !isViewPath(value.canonicalPath)
  )
    return undefined;
  if (
    value.comparisonUrl !== null &&
    (typeof value.comparisonUrl !== "string" ||
      !/^\/__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/.test(
        value.comparisonUrl,
      ))
  )
    return undefined;
  if (
    !value.idRoutes ||
    typeof value.idRoutes !== "object" ||
    Array.isArray(value.idRoutes)
  )
    return undefined;
  const idRoutes: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  for (const [id, route] of Object.entries(value.idRoutes)) {
    if (!isCatalogueId(id) || !isViewPath(route)) return undefined;
    idRoutes[id] = route;
  }
  return {
    schemaVersion: 2,
    deploymentId: value.deploymentId,
    canonicalPath: value.canonicalPath as string,
    comparisonUrl: value.comparisonUrl,
    idRoutes,
  };
}

/** Resolve a logical-id request without depending on a static-host redirect. */
export function resolveDeliveryHref(
  href: string,
  delivery?: StaticDelivery,
): string | undefined {
  if (!delivery) return href;
  const match =
    /^\/id\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/(?:index\.html)?)?(\?[^#]*)?$/.exec(
      href,
    );
  if (!match) return undefined;
  const target = delivery.idRoutes[match[1] ?? ""];
  if (!target) return undefined;
  return `${target}${validFragmentQuery(match[2] ?? "")}`;
}

/** Keep only one syntactically valid logical fragment on a canonical URL. */
export function validFragmentQuery(search: string): string {
  const values = new URLSearchParams(search).getAll("fragment");
  return values.length === 1 && isLogicalFragment(values[0])
    ? `?fragment=${encodeURIComponent(values[0])}`
    : "";
}
