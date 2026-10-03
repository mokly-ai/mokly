import {
  expired,
  publicationKey,
  type FakeReceiverPublication,
  type FakeUpload,
  type FakeUploadCompletion,
} from "./fake_receiver_support.js";

/** Receiver result for one Complete request after applying idempotency. */
export interface FakeCompleteResult extends FakeUploadCompletion {
  firstCompletion: boolean;
}

/** Resolve Complete at request time and retain its first successful result. */
export function resolveFakeComplete(
  upload: FakeUpload | undefined,
  blobs: ReadonlyMap<string, Buffer>,
  publications: Map<string, FakeReceiverPublication>,
  origin: string,
  nextPublicationId: () => string,
): FakeCompleteResult {
  if (!upload) return { firstCompletion: false, status: 404 };
  if (upload.completion)
    return { ...upload.completion, firstCompletion: false };
  if (expired(upload)) return { firstCompletion: false, status: 410 };

  const key = publicationKey(upload.manifest);
  const existing = publications.get(key);
  let status: 200 | 201;
  let responseBody: Buffer;
  if (existing) {
    status = 200;
    responseBody = existing.responseBody;
  } else {
    if ([...upload.entriesByDigest.keys()].some((digest) => !blobs.has(digest)))
      return { firstCompletion: false, status: 409 };
    status = 201;
    const publicationId = nextPublicationId();
    const body = {
      id: publicationId,
      projectId: "fake-project",
      state: "published",
      catalogueUrl: `${origin}/catalogues/${publicationId}`,
      viewerUrl: `${origin}/catalogues/${publicationId}/view`,
    };
    responseBody = Buffer.from(JSON.stringify(body));
    publications.set(key, { body, manifest: upload.manifest, responseBody });
  }
  upload.completion = { body: responseBody, status };
  return { ...upload.completion, firstCompletion: true };
}
