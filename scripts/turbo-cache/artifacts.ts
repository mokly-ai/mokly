import { authenticate, authorize } from "./auth.js";
import type { CacheAccess, CacheBindings } from "./auth.js";
import { CacheError, errorResponse } from "./errors.js";
import {
  ARRAY_LIMIT,
  ARTIFACT_LIMIT,
  JSON_LIMIT,
  artifactHeaders,
  contentLength,
  requireMediaType,
  uploadMetadata,
  validateHash,
} from "./metadata.js";
import type {
  ArtifactBody,
  ArtifactDescriptor,
  ArtifactStore,
} from "./store.js";
import { countedUpload, readJson } from "./stream.js";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

async function findArtifact(
  store: ArtifactStore,
  access: CacheAccess,
  hash: string,
  method: "get",
): Promise<ArtifactBody | null>;
async function findArtifact(
  store: ArtifactStore,
  access: CacheAccess,
  hash: string,
  method: "head",
): Promise<ArtifactDescriptor | null>;
async function findArtifact(
  store: ArtifactStore,
  access: CacheAccess,
  hash: string,
  method: "get" | "head",
) {
  for (const namespace of access.readNamespaces) {
    const artifact = await store[method](`${namespace}/${hash}`);
    if (artifact) return artifact;
  }
  return null;
}

async function put(
  request: Request,
  store: ArtifactStore,
  access: CacheAccess,
  hash: string,
  url: URL,
): Promise<Response> {
  if (access.principal === "reader")
    throw new CacheError(403, "forbidden", "Cache writes denied.");
  requireMediaType(request.headers, "application/octet-stream");
  const length = contentLength(request.headers, ARTIFACT_LIMIT, true)!;
  const metadata = uploadMetadata(request.headers, access.principal);
  const upload = countedUpload(request.body, length);
  try {
    await store.putIfAbsent(
      `${access.namespace}/${hash}`,
      upload.stream,
      metadata,
      length,
    );
    await upload.finish();
  } catch (error) {
    throw upload.failure ?? error;
  } finally {
    await upload.cancel();
  }
  const location = new URL(
    `/v8/artifacts/${encodeURIComponent(hash)}`,
    url.origin,
  );
  location.searchParams.set("slug", access.namespace);
  return json({ urls: [location.href] }, 202);
}

function batchHashes(value: unknown): string[] {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("hashes" in value) ||
    !Array.isArray(value.hashes)
  )
    throw new CacheError(400, "bad_request", "Invalid artifact batch.");
  if (value.hashes.length > ARRAY_LIMIT)
    throw new CacheError(413, "too_large", "Too many artifact hashes.");
  return value.hashes.map((hash: unknown) => {
    if (typeof hash !== "string")
      throw new CacheError(400, "bad_request", "Invalid artifact hash.");
    return validateHash(hash);
  });
}

async function post(
  request: Request,
  store: ArtifactStore,
  access: CacheAccess,
  events: boolean,
): Promise<Response> {
  requireMediaType(request.headers, "application/json");
  contentLength(request.headers, JSON_LIMIT, false);
  const value = await readJson(request);
  if (events) {
    if (!Array.isArray(value))
      throw new CacheError(
        400,
        "bad_request",
        "Cache events must be an array.",
      );
    if (value.length > ARRAY_LIMIT)
      throw new CacheError(413, "too_large", "Too many cache events.");
    return new Response(null, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const hashes = batchHashes(value);
  const result: Record<string, unknown> = {};
  for (const hash of hashes) {
    const artifact = await findArtifact(store, access, hash, "head");
    if (!artifact) {
      result[hash] = null;
      continue;
    }
    const { duration, principal: _principal, ...optional } = artifact.metadata;
    result[hash] = {
      size: artifact.size,
      taskDurationMs: Number(duration),
      ...optional,
    };
  }
  return json(result);
}

/** Route the CLI cache protocol using only standard Request/Response/stream APIs. */
export function createCacheHandler(
  store: ArtifactStore,
  bindings: CacheBindings,
  warn: (message: string) => void = console.warn,
) {
  return async (request: Request): Promise<Response> => {
    try {
      const identity = await authenticate(request, bindings, warn);
      const url = new URL(request.url);
      const access = authorize(url, identity.principal, identity.team);
      const path = url.pathname;
      const artifactPath = /^\/v8\/artifacts\/([^/]+)$/u.exec(path);
      const route =
        path === "/v8/artifacts/status"
          ? "status"
          : path === "/v8/artifacts/events"
            ? "events"
            : path === "/v8/artifacts"
              ? "batch"
              : artifactPath
                ? "artifact"
                : "missing";
      if (route === "missing")
        throw new CacheError(404, "not_found", "Cache route not found.");
      const methods =
        route === "artifact"
          ? ["GET", "HEAD", "PUT"]
          : route === "status"
            ? ["GET"]
            : ["POST"];
      if (!methods.includes(request.method)) {
        const response = errorResponse(
          new CacheError(
            405,
            "method_not_allowed",
            "Cache method not allowed.",
          ),
          request.method === "HEAD",
        );
        response.headers.set("Allow", methods.join(", "));
        return response;
      }
      if (route === "status") return json({ status: "enabled" });
      if (route === "events" || route === "batch")
        return await post(request, store, access, route === "events");
      let hash: string;
      try {
        hash = validateHash(decodeURIComponent(artifactPath![1]!));
      } catch (error) {
        if (error instanceof CacheError) throw error;
        throw new CacheError(400, "bad_request", "Invalid artifact hash.");
      }
      if (request.method === "PUT")
        return await put(request, store, access, hash, url);
      if (request.method === "HEAD") {
        const artifact = await findArtifact(store, access, hash, "head");
        if (!artifact)
          throw new CacheError(404, "not_found", "Artifact not found.");
        return new Response(null, {
          status: 200,
          headers: artifactHeaders(artifact),
        });
      }
      const artifact = await findArtifact(store, access, hash, "get");
      if (!artifact)
        throw new CacheError(404, "not_found", "Artifact not found.");
      return new Response(artifact.body, {
        status: 200,
        headers: artifactHeaders(artifact),
      });
    } catch (error) {
      return errorResponse(error, request.method === "HEAD", warn);
    }
  };
}
