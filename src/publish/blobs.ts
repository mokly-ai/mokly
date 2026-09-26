import { MoklyError } from "../errors.js";

import {
  cancelResponse,
  requestAttempt,
  retryableResponse,
  statusError,
} from "./http.js";
import type { UploadRequestDependencies } from "./plan.js";
import { ReplanRequired, retryRequest } from "./retry.js";
import type { PlanResponse, UploadOptions } from "./types.js";

/** Exact bytes and declared metadata for one content-addressed blob. */
export interface UploadBlob {
  sha256: string;
  size: number;
  bytes: Buffer;
}

/** Upload each missing digest once through a cancellation-aware worker pool. */
export async function uploadMissingBlobs(
  plan: PlanResponse,
  blobs: ReadonlyMap<string, UploadBlob>,
  options: UploadOptions,
  concurrency: number,
  dependencies: UploadRequestDependencies,
  signal?: AbortSignal,
  onUploaded?: (digest: string) => void,
): Promise<Set<string>> {
  const controller = new AbortController();
  const poolSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  let cursor = 0;
  let failure: unknown;
  const worker = async (): Promise<void> => {
    while (failure === undefined) {
      const digest = plan.missing[cursor++];
      if (digest === undefined) return;
      const blob = blobs.get(digest);
      if (!blob) {
        failure = invalidBundle();
        controller.abort();
        return;
      }
      try {
        await uploadBlob(plan, blob, options, dependencies, poolSignal);
        onUploaded?.(digest);
      } catch (error) {
        if (failure === undefined) {
          failure = error;
          controller.abort();
        }
        return;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, plan.missing.length) }, worker),
  );
  if (failure !== undefined) throw failure;
  return new Set(plan.missing);
}

async function uploadBlob(
  plan: PlanResponse,
  blob: UploadBlob,
  options: UploadOptions,
  dependencies: UploadRequestDependencies,
  signal: AbortSignal,
): Promise<void> {
  await retryRequest(
    dependencies,
    () =>
      requestAttempt(
        dependencies.fetch,
        plan.blobUrl.replace("{sha256}", blob.sha256),
        {
          method: "PUT",
          redirect: "manual",
          headers: {
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/octet-stream",
            "Content-Length": String(blob.size),
          },
          body: blob.bytes as Buffer<ArrayBuffer>,
        },
        signal,
        async (response) => {
          const retry = retryableResponse(response);
          if (retry) {
            await cancelResponse(response);
            throw retry;
          }
          if (response.status === 410) {
            await cancelResponse(response);
            throw new ReplanRequired();
          }
          await cancelResponse(response);
          if (response.ok) return;
          throw statusError(response.status);
        },
      ),
    { signal, expiresAt: plan.upload.expiresAt },
  );
}

function invalidBundle(): MoklyError {
  return new MoklyError(
    "upload-invalid-bundle",
    "The upload plan requested a file outside the finalized export.",
  );
}
