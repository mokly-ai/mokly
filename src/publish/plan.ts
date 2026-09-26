import type { ReviewArtifactContent } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";
import { EXPORT_MARKER } from "../export/ownership.js";

import { bundleUpload } from "./bundle.js";
import {
  cancelResponse,
  readBoundedBody,
  requestAttempt,
  retryableResponse,
  statusError,
  uploadFailed,
} from "./http.js";
import { UPLOAD_MANIFEST } from "./manifest.js";
import { retryRequest, type RetryDependencies } from "./retry.js";
import type { PlanResponse, UploadManifest, UploadOptions } from "./types.js";
import { uploadTimestamp } from "./validation.js";

const SHA256 = /^[a-f0-9]{64}$/;
const PLACEHOLDER = "{sha256}";
const PROBE_DIGEST = "a".repeat(64);

/** HTTP and retry boundaries used by plan, blob and completion requests. */
export interface UploadRequestDependencies extends RetryDependencies {
  fetch: typeof fetch;
}

/** Build the deterministic two- or three-file plan archive. */
export async function buildPlanArchive(
  files: ReadonlyMap<string, ReviewArtifactContent>,
  manifest: UploadManifest,
  signal?: AbortSignal,
): Promise<Buffer> {
  const names = [
    UPLOAD_MANIFEST,
    EXPORT_MARKER,
    ...(manifest.comparisonPath ? [manifest.comparisonPath] : []),
  ];
  const selected = new Map<string, Buffer>();
  for (const name of names) {
    const content = files.get(name);
    if (content === undefined) throw invalidBundle();
    selected.set(name, Buffer.from(content));
  }
  return bundleUpload(selected, signal);
}

/** POST one plan archive and return its strictly validated response. */
export async function requestUploadPlan(
  options: UploadOptions,
  archive: Buffer,
  markerDigests: ReadonlySet<string>,
  dependencies: UploadRequestDependencies,
  signal?: AbortSignal,
): Promise<PlanResponse> {
  return retryRequest(
    dependencies,
    () =>
      requestAttempt(
        dependencies.fetch,
        options.endpoint,
        {
          method: "POST",
          redirect: "manual",
          headers: {
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/gzip",
            Accept: "application/json",
            "Content-Length": String(archive.length),
          },
          body: archive as Buffer<ArrayBuffer>,
        },
        signal,
        async (response) => {
          const retry = retryableResponse(response);
          if (retry) {
            await cancelResponse(response);
            throw retry;
          }
          if (response.status !== 200) {
            await cancelResponse(response);
            if (response.ok) throw uploadFailed();
            throw statusError(response.status);
          }
          if (mediaType(response) !== "application/json") {
            await cancelResponse(response);
            throw uploadFailed();
          }
          const body = await readBoundedBody(response);
          if (body === undefined) throw uploadFailed();
          let value: unknown;
          try {
            value = JSON.parse(body.toString("utf8"));
          } catch {
            throw uploadFailed();
          }
          return validatePlanResponse(value, options.endpoint, markerDigests);
        },
      ),
    signal ? { signal } : {},
  );
}

/** Validate a decoded plan document against the endpoint and marker digests. */
export function validatePlanResponse(
  value: unknown,
  endpoint: string,
  markerDigests: ReadonlySet<string>,
): PlanResponse {
  if (!record(value) || value["schemaVersion"] !== 1) throw uploadFailed();
  const upload = value["upload"];
  if (
    !record(upload) ||
    !opaqueId(upload["id"]) ||
    !uploadTimestamp(upload["expiresAt"])
  )
    throw uploadFailed();
  const missing = value["missing"];
  if (!Array.isArray(missing)) throw uploadFailed();
  let previous: string | undefined;
  for (const digest of missing) {
    if (
      typeof digest !== "string" ||
      !SHA256.test(digest) ||
      !markerDigests.has(digest) ||
      (previous !== undefined && previous >= digest)
    )
      throw uploadFailed();
    previous = digest;
  }
  if (
    typeof value["blobUrl"] !== "string" ||
    !validBlobUrl(value["blobUrl"], endpoint) ||
    typeof value["completeUrl"] !== "string" ||
    !validAbsoluteUrl(value["completeUrl"], endpoint)
  )
    throw uploadFailed();
  return {
    schemaVersion: 1,
    upload: { id: upload["id"], expiresAt: upload["expiresAt"] },
    missing: [...missing] as string[],
    blobUrl: value["blobUrl"],
    completeUrl: value["completeUrl"],
  };
}

function validBlobUrl(value: string, endpoint: string): boolean {
  const first = value.indexOf(PLACEHOLDER);
  if (first < 0 || first !== value.lastIndexOf(PLACEHOLDER)) return false;
  const boundary = [value.indexOf("?"), value.indexOf("#")]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  if (boundary !== undefined && first > boundary) return false;
  const replaced = value.replace(PLACEHOLDER, PROBE_DIGEST);
  try {
    const url = new URL(replaced);
    return (
      !url.username &&
      !url.password &&
      url.origin === new URL(endpoint).origin &&
      url.pathname.includes(PROBE_DIGEST)
    );
  } catch {
    return false;
  }
}

function validAbsoluteUrl(value: string, endpoint: string): boolean {
  try {
    const url = new URL(value);
    return (
      !url.username && !url.password && url.origin === new URL(endpoint).origin
    );
  } catch {
    return false;
  }
}

function mediaType(response: Response): string | undefined {
  return response.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
}

function opaqueId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value) <= 255 &&
    Buffer.from(value).toString("utf8") === value
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function invalidBundle(): MoklyError {
  return new MoklyError(
    "upload-invalid-bundle",
    "The export is missing a required upload artifact. Rebuild it and retry.",
  );
}
