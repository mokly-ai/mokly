import {
  expired,
  joinedPublication,
  publicationKey,
  type FakeReceiverPublication,
  type FakeUpload,
  type FakeUploadCompletion,
} from "./fake_receiver_support.js";

/** Receiver result for one Complete request after applying idempotency. */
export interface FakeCompleteResult extends FakeUploadCompletion {
  firstCompletion: boolean;
}

/** Completed publications: clean ones by commit key, dirty ones in order. */
export interface FakePublicationStore {
  publications: Map<string, FakeReceiverPublication>;
  dirtyPublications: FakeReceiverPublication[];
}

/** Resolve Complete at request time and retain its first successful result. */
export function resolveFakeComplete(
  upload: FakeUpload | undefined,
  blobs: ReadonlyMap<string, Buffer>,
  store: FakePublicationStore,
  origin: string,
  nextPublicationId: () => string,
): FakeCompleteResult {
  if (!upload) return { firstCompletion: false, status: 404 };
  if (upload.completion)
    return { ...upload.completion, firstCompletion: false };
  if (expired(upload)) return { firstCompletion: false, status: 410 };

  const existing = joinedPublication(upload.manifest, store.publications);
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
    const publication = { body, manifest: upload.manifest, responseBody };
    if (upload.manifest.uncommittedChanges)
      store.dirtyPublications.push(publication);
    else store.publications.set(publicationKey(upload.manifest), publication);
  }
  upload.completion = { body: responseBody, status };
  return { ...upload.completion, firstCompletion: true };
}
