import { bundleUpload } from "../../dist/publish/bundle.js";
import type { PlanResponse, UploadManifest } from "../../dist/publish/types.js";

import { ownershipMarkerFromFiles } from "./ownership_marker.js";

/** Build one valid current-only Plan archive with selected contract mutations. */
export async function fakePlanArchive(
  options: {
    corruptManifestDigest?: boolean;
    manifestText?: string;
    manifestVersion?: number;
    markerSize?: number;
    markerVersion?: number;
  } = {},
) {
  const manifest: UploadManifest = {
    schemaVersion: 2,
    moklyVersion: "1.2.3",
    repository: { host: "github.com", owner: "sample", name: "catalogue" },
    branch: "main",
    headSha: "a".repeat(40),
    baseRef: null,
    baseSha: null,
    pullRequest: null,
    configPath: "mokly.config.ts",
    exportedAt: "2026-09-26T12:00:00.000Z",
    comparisonPath: null,
  };
  const manifestBytes = Buffer.from(
    options.manifestText ??
      `${JSON.stringify({ ...manifest, schemaVersion: options.manifestVersion ?? 2 })}\n`,
  );
  const files = new Map<string, Buffer>([
    ["index.html", Buffer.from("home")],
    ["404.html", Buffer.from("missing")],
    ["mokly-upload.json", manifestBytes],
  ]);
  const marker = ownershipMarkerFromFiles(files);
  if (options.corruptManifestDigest)
    marker.files.find(({ path }) => path === "mokly-upload.json")!.sha256 =
      "0".repeat(64);
  if (options.markerSize !== undefined)
    marker.files[0]!.size = options.markerSize;
  const markerBytes = Buffer.from(
    `${JSON.stringify({ ...marker, schemaVersion: options.markerVersion ?? 3 })}\n`,
  );
  return {
    archive: await bundleUpload(
      new Map([
        ["mokly-upload.json", manifestBytes],
        [".mokly-export-artifact", markerBytes],
      ]),
    ),
    files,
    manifest,
    marker,
  };
}

/** POST one Plan archive with the fake receiver's documented headers. */
export function fakePlanRequest(
  endpoint: string,
  body: Buffer,
  token: string,
): Promise<Response> {
  return fetch(endpoint, {
    method: "POST",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/gzip",
      Accept: "application/json",
      "Content-Length": String(body.length),
    },
    body: fakeRequestBody(body),
  });
}

/** Upload every digest requested by one fake receiver Plan. */
export async function uploadFakePlanBlobs(
  plan: PlanResponse,
  fixture: Awaited<ReturnType<typeof fakePlanArchive>>,
  token: string,
): Promise<void> {
  for (const digest of plan.missing) {
    const entry = fixture.marker.files.find(({ sha256 }) => sha256 === digest)!;
    const bytes = fixture.files.get(entry.path)!;
    const response = await fetch(plan.blobUrl.replace("{sha256}", digest), {
      method: "PUT",
      headers: fakeBlobHeaders(bytes.length, token),
      body: fakeRequestBody(bytes),
    });
    if (response.status !== 204)
      throw new Error(`fake Blob upload failed with ${response.status}`);
  }
}

/** Headers for one raw fake-receiver Blob request. */
export function fakeBlobHeaders(
  size: number,
  token: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/octet-stream",
    "Content-Length": String(size),
  };
}

/** POST an empty Complete request to the fake receiver. */
export function fakeCompleteRequest(
  url: string,
  token: string,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Length": "0",
    },
  });
}

/** Copy Buffer bytes into the fetch-compatible ArrayBuffer view. */
export function fakeRequestBody(bytes: Buffer): Uint8Array<ArrayBuffer> {
  const body = new Uint8Array(bytes.length);
  body.set(bytes);
  return body;
}
