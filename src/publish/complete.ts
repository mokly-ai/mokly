import {
  cancelResponse,
  readBoundedBody,
  requestAttempt,
  retryableResponse,
  statusError,
  uploadFailed,
} from "./http.js";
import type { UploadRequestDependencies } from "./plan.js";
import { ReplanRequired, retryRequest } from "./retry.js";
import type { PlanResponse, PublishResult, UploadOptions } from "./types.js";

/** Complete one upload plan, retrying safe failures until its expiry. */
export async function completeUpload(
  plan: PlanResponse,
  options: UploadOptions,
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
  if (mediaType(response) !== "application/json") {
    await cancelResponse(response);
    return null;
  }
  let body: Buffer | undefined;
  try {
    body = await readBoundedBody(response);
  } catch {
    if (signal?.aborted) throw uploadFailed();
    return null;
  }
  if (body === undefined) return null;
  let value: unknown;
  try {
    value = JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
  if (!record(value) || typeof value["viewerUrl"] !== "string") return null;
  try {
    const url = new URL(value["viewerUrl"]);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function mediaType(response: Response): string | undefined {
  return response.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
