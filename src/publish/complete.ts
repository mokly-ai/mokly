import {
  dirtyUploadJoined,
  publishCancelled,
  statusError,
  uploadFailed,
} from "./errors.js";
import {
  cancelResponse,
  readBoundedBody,
  requestAttempt,
  responseMediaType,
  retryableResponse,
} from "./http.js";
import type { UploadRequestDependencies } from "./plan.js";
import { ReplanRequired, retryRequest } from "./retry.js";
import type { CompleteOptions, PlanResponse, PublishResult } from "./types.js";
import { isRecord } from "./validation.js";

/** Complete one upload plan, retrying safe failures until its expiry. */
export async function completeUpload(
  plan: PlanResponse,
  options: CompleteOptions,
  dependencies: UploadRequestDependencies,
  signal?: AbortSignal,
): Promise<Pick<PublishResult, "outcome" | "viewerUrl">> {
  return retryRequest(
    dependencies,
    () =>
      requestAttempt(
        dependencies.fetch,
        plan.completeUrl,
        {
          method: "POST",
          redirect: "manual",
          headers: {
            Authorization: `Bearer ${options.token}`,
            Accept: "application/json",
            "Content-Length": "0",
          },
        },
        signal,
        async (response) => {
          const retry = retryableResponse(response);
          if (retry) {
            await cancelResponse(response);
            throw retry;
          }
          if (response.status === 409 || response.status === 410) {
            await cancelResponse(response);
            throw new ReplanRequired();
          }
          if (response.status !== 200 && response.status !== 201) {
            await cancelResponse(response);
            if (response.ok) throw uploadFailed();
            throw statusError(response.status);
          }
          if (response.status === 200 && options.uncommittedChanges) {
            await cancelResponse(response);
            throw dirtyUploadJoined();
          }
          return {
            outcome:
              response.status === 201
                ? ("published" as const)
                : ("already-published" as const),
            viewerUrl: await optionalViewerUrl(response, signal),
          };
        },
      ),
    {
      ...(signal ? { signal } : {}),
      expiresAt: plan.upload.expiresAt,
    },
  );
}

async function optionalViewerUrl(
  response: Response,
  signal?: AbortSignal,
): Promise<string | null> {
  if (responseMediaType(response) !== "application/json") {
    await cancelResponse(response);
    return null;
  }
  let body: Buffer | undefined;
  try {
    body = await readBoundedBody(response);
  } catch {
    if (signal?.aborted) throw publishCancelled();
    return null;
  }
  if (body === undefined) return null;
  let value: unknown;
  try {
    value = JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value["viewerUrl"] !== "string") return null;
  try {
    const url = new URL(value["viewerUrl"]);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
