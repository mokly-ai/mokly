import { SITE_FIRST_SEGMENTS } from "./site-segments";

interface Env {
  DOMAIN: string;
}

interface OriginTarget {
  host: string;
  preview: boolean;
  disposable: boolean;
}

/** The three public/internal names that identify one application environment. */
export interface DomainLayout {
  internalAppHost: string;
  publicApiHost: string;
  publicAppOrigin: string;
}

const previewLabelSuffix = ".preview.";
const prLabel = /^pr-([1-9][0-9]{0,8})$/;
const branchLabel = /^br-([a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?)$/;
const prEnvironment = /^preview-pr-([1-9][0-9]{0,8})$/;
const branchEnvironment = /^([a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?)-preview$/;
/**
 * Fetch options that keep app-origin subrequests out of the Cloudflare cache.
 * A negative TTL for every status tells Cloudflare not to cache at all, so the
 * origin's Cache-Control reaches the client untouched. `cacheTtl: 0` is not a
 * bypass: it caches with an immediate expiry and rewrites Cache-Control to the
 * zone browser TTL.
 */
const cacheBypass: RequestInit & {
  cf: { cacheTtlByStatus: Record<string, number> };
} = {
  cf: { cacheTtlByStatus: { "200-599": -1 } },
};

const siteFirstSegments = new Set<string>(SITE_FIRST_SEGMENTS);

function isProductionSitePath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (
    pathname === "/.well-known/acme-challenge" ||
    pathname.startsWith("/.well-known/acme-challenge/")
  ) {
    return true;
  }
  return siteFirstSegments.has(pathname.slice(1).split("/", 1)[0] ?? "");
}

function isPreviewHost(hostname: string, domain: string): boolean {
  const comparisonHost = hostname.endsWith(".")
    ? hostname.slice(0, -1)
    : hostname;
  return comparisonHost.endsWith(`${previewLabelSuffix}${domain}`);
}

/** Derive the unified host layout for a provisionable environment name. */
export function domainLayout(
  environment: string,
  domain: string,
): DomainLayout | null {
  if (environment === "production") {
    return {
      internalAppHost: `app-origin.${domain}`,
      publicApiHost: `api.${domain}`,
      publicAppOrigin: `https://${domain}`,
    };
  }
  const pullRequest = prEnvironment.exec(environment);
  const branch = branchEnvironment.exec(environment);
  const label = pullRequest
    ? `pr-${pullRequest[1]}`
    : branch
      ? `br-${branch[1]}`
      : null;
  if (label === null) return null;
  return {
    internalAppHost: pullRequest
      ? `app-origin-${label}.preview.${domain}`
      : `app-origin-${environment}.${domain}`,
    publicApiHost: `${label}.preview.api.${domain}`,
    publicAppOrigin: `https://${label}.preview.${domain}`,
  };
}

function target(
  environment: string,
  domain: string,
  disposable: boolean,
): OriginTarget | null {
  const layout = domainLayout(environment, domain);
  return layout === null
    ? null
    : {
        host: layout.internalAppHost,
        preview: environment !== "production",
        disposable,
      };
}

function originTarget(hostname: string, domain: string): OriginTarget | null {
  if (hostname === domain) {
    return target("production", domain, false);
  }

  const suffix = `${previewLabelSuffix}${domain}`;
  if (!hostname.endsWith(suffix)) {
    return null;
  }
  const label = hostname.slice(0, -suffix.length);
  if (!label || label.includes(".")) {
    return null;
  }
  const pullRequest = prLabel.exec(label);
  if (pullRequest) {
    return target(`preview-pr-${pullRequest[1]}`, domain, true);
  }
  const branch = branchLabel.exec(label);
  if (branch) {
    return target(`${branch[1]}-preview`, domain, branch[1] !== "main");
  }
  return null;
}

export function appOriginHost(hostname: string, domain: string): string | null {
  return originTarget(hostname, domain)?.host ?? null;
}

function syntheticHeaders(preview: boolean, contentType: string): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });
  if (preview) {
    headers.set("X-Robots-Tag", "noindex");
  }
  return headers;
}

function notFound(preview: boolean): Response {
  return new Response(null, {
    status: 404,
    headers: syntheticHeaders(preview, "text/plain; charset=UTF-8"),
  });
}

function health(preview: boolean): Response {
  return new Response("ok", {
    status: 200,
    headers: syntheticHeaders(preview, "text/plain; charset=UTF-8"),
  });
}

function rewriteAbsoluteUrl(
  value: string,
  internalHost: string,
  publicUrl: URL,
): string {
  let url: URL;
  try {
    url = new URL(value, publicUrl);
  } catch {
    return value;
  }
  if (url.hostname !== internalHost) {
    return value;
  }
  url.protocol = "https:";
  url.host = publicUrl.host;
  return url.toString();
}

function rewriteLinkHeader(
  value: string,
  internalHost: string,
  publicUrl: URL,
): string {
  return value.replace(/<([^>]*)>/g, (reference, url: string) => {
    const rewritten = rewriteAbsoluteUrl(url, internalHost, publicUrl);
    return rewritten === url ? reference : `<${rewritten}>`;
  });
}

function proxyResponse(
  response: Response,
  target: OriginTarget,
  publicUrl: URL,
): Response {
  const headers = new Headers(response.headers);
  for (const name of ["Location", "Content-Location"]) {
    const value = headers.get(name);
    if (value !== null) {
      headers.set(name, rewriteAbsoluteUrl(value, target.host, publicUrl));
    }
  }
  const link = headers.get("Link");
  if (link !== null) {
    headers.set("Link", rewriteLinkHeader(link, target.host, publicUrl));
  }
  if (target.preview) {
    headers.set("X-Robots-Tag", "noindex");
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function proxy(
  request: Request,
  url: URL,
  target: OriginTarget,
): Promise<Response> {
  const originUrl = new URL(url);
  originUrl.protocol = "https:";
  originUrl.hostname = target.host;
  originUrl.port = "";
  const forwarded = new Request(originUrl, request);
  forwarded.headers.delete("Host");
  forwarded.headers.set("X-Forwarded-Host", url.host);
  forwarded.headers.set("X-Forwarded-Proto", "https");
  const originRequest = new Request(forwarded, { redirect: "manual" });
  let response: Response;
  try {
    response = await fetch(originRequest, cacheBypass);
  } catch (error) {
    if (target.disposable) return notFound(true);
    throw error;
  }
  return proxyResponse(response, target, url);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const preview = isPreviewHost(url.hostname, env.DOMAIN);
    const target = originTarget(url.hostname, env.DOMAIN);
    if (target === null) {
      return notFound(preview);
    }
    if (url.pathname === "/_router-health") {
      return health(target.preview);
    }
    if (!target.preview && isProductionSitePath(url.pathname)) {
      return fetch(request);
    }
    return proxy(request, url, target);
  },
};
