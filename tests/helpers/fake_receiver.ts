import http from "node:http";

import { FakeReceiverRejection } from "./fake_receiver_archive.js";
import {
  delay,
  expired,
  nextOverride,
  publicationKey,
  requestBytes,
  requestKind,
  routePath,
  safeHeaders,
  validBlob,
  validCompleteHeaders,
  validPlanHeaders,
  type FakeReceiverControl,
  type FakeReceiverOverride,
  type FakeReceiverPlan,
  type FakeReceiverPublication,
  type FakeReceiverRequest,
  type FakeRequestKind,
  type FakeUpload,
  type QueuedOverride,
} from "./fake_receiver_support.js";
import {
  validateFakePlanArchive,
  type ValidatedFakePlan,
} from "./fake_receiver_validation.js";

export type {
  FakeReceiverControl,
  FakeReceiverOverride,
  FakeReceiverPlan,
  FakeReceiverPublication,
  FakeReceiverRequest,
  FakeRequestKind,
} from "./fake_receiver_support.js";

/** Observable receiver state and script controls exposed to integration tests. */
export interface FakeReceiver {
  readonly blobs: Map<string, Buffer>;
  readonly control: FakeReceiverControl;
  readonly endpoint: string;
  readonly maxConcurrentPuts: number;
  readonly origin: string;
  readonly plans: FakeReceiverPlan[];
  readonly publications: Map<string, FakeReceiverPublication>;
  readonly puts: string[];
  readonly requests: FakeReceiverRequest[];
  close(): Promise<void>;
  dropBlob(digest: string): void;
  queue(
    kind: Exclude<FakeRequestKind, "unknown">,
    override: FakeReceiverOverride,
  ): void;
}

/** Start a stateful receiver that exercises the public plan/blob/complete contract. */
export async function startFakeReceiver(
  context?: { after(callback: () => Promise<void>): void },
  options: { endpointPath?: string; token?: string } = {},
): Promise<FakeReceiver> {
  const token = options.token ?? "fixture-token";
  const endpointPath = routePath(options.endpointPath ?? "/upload");
  const blobs = new Map<string, Buffer>();
  const plans: FakeReceiverPlan[] = [];
  const publications = new Map<string, FakeReceiverPublication>();
  const puts: string[] = [];
  const requests: FakeReceiverRequest[] = [];
  const uploads = new Map<string, FakeUpload>();
  const overrides = new Map<FakeRequestKind, QueuedOverride[]>();
  const control: FakeReceiverControl = {
    blobDelayMs: 0,
    defaultExpiryMs: 60 * 60 * 1_000,
    expiryMs: [],
  };
  let origin = "";
  let activePuts = 0;
  let maxConcurrentPuts = 0;
  let publicationNumber = 0;

  const server = http.createServer((request, response) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });

  async function handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    const path = request.url ?? "/";
    const kind = requestKind(request.method ?? "", path, endpointPath);
    if (kind === "blob") {
      activePuts++;
      maxConcurrentPuts = Math.max(maxConcurrentPuts, activePuts);
    }
    try {
      const body = await requestBytes(request);
      const log: FakeReceiverRequest = {
        bodySize: body.length,
        headers: safeHeaders(request.headers),
        kind,
        method: request.method ?? "",
        path,
        status: 500,
      };
      requests.push(log);
      const send = (status: number, document?: unknown, headers = {}): void => {
        log.status = status;
        const bytes =
          document === undefined
            ? undefined
            : Buffer.from(
                typeof document === "string"
                  ? document
                  : JSON.stringify(document),
              );
        response.writeHead(status, {
          ...(bytes ? { "Content-Length": String(bytes.length) } : {}),
          ...(document !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...headers,
        });
        response.end(bytes);
      };
      if (request.headers.authorization !== `Bearer ${token}`) {
        send(401);
        return;
      }
      const override = nextOverride(overrides.get(kind));
      if (override) {
        if (kind === "blob" && control.blobDelayMs)
          await delay(control.blobDelayMs);
        send(override.status, override.body, {
          ...(override.retryAfter === undefined
            ? {}
            : { "Retry-After": override.retryAfter }),
        });
        return;
      }
      if (kind === "plan") {
        if (!validPlanHeaders(request.headers, body.length)) {
          send(400);
          return;
        }
        let validated: ValidatedFakePlan;
        try {
          validated = await validateFakePlanArchive(body);
        } catch (error) {
          send(error instanceof FakeReceiverRejection ? error.status : 400);
          return;
        }
        const id = `upload-${plans.length + 1}`;
        const existing = publications.get(publicationKey(validated.manifest));
        for (const [name, bytes] of validated.files) {
          const entry = validated.ownership.files.find(
            (candidate) => candidate.path === name,
          );
          if (entry) blobs.set(entry.sha256, bytes);
        }
        const missing = existing
          ? []
          : [...validated.entriesByDigest.keys()]
              .filter((digest) => !blobs.has(digest))
              .sort();
        const expiry = control.expiryMs.shift() ?? control.defaultExpiryMs;
        const plan: FakeUpload = {
          ...validated,
          archive: body,
          expiresAt: new Date(Date.now() + expiry).toISOString(),
          id,
          missing,
          ...(existing ? { existing } : {}),
        };
        uploads.set(id, plan);
        plans.push(plan);
        send(200, {
          schemaVersion: 1,
          upload: { id, expiresAt: plan.expiresAt },
          missing,
          blobUrl: `${origin}/uploads/${id}/blobs/{sha256}`,
          completeUrl: `${origin}/uploads/${id}/complete`,
        });
        return;
      }
      if (kind === "blob") {
        if (control.blobDelayMs) await delay(control.blobDelayMs);
        const match = /^\/uploads\/([^/]+)\/blobs\/([a-f0-9]{64})$/u.exec(
          new URL(path, origin).pathname,
        );
        const upload = match ? uploads.get(match[1] ?? "") : undefined;
        const digest = match?.[2] ?? "";
        const entry = upload?.entriesByDigest.get(digest);
        if (!upload || !entry) {
          send(404);
          return;
        }
        if (expired(upload)) {
          send(410);
          return;
        }
        if (!validBlob(request.headers, entry, body, digest)) {
          send(400);
          return;
        }
        blobs.set(digest, body);
        puts.push(digest);
        send(204);
        return;
      }
      if (kind === "complete") {
        if (!validCompleteHeaders(request.headers, body.length)) {
          send(400);
          return;
        }
        const match = /^\/uploads\/([^/]+)\/complete$/u.exec(
          new URL(path, origin).pathname,
        );
        const upload = match ? uploads.get(match[1] ?? "") : undefined;
        if (!upload) {
          send(404);
          return;
        }
        if (expired(upload)) {
          send(410);
          return;
        }
        if (upload.existing) {
          send(200, upload.existing.body);
          return;
        }
        if (
          [...upload.entriesByDigest].some(([digest]) => !blobs.has(digest))
        ) {
          send(409);
          return;
        }
        const publicationId = `publication-${++publicationNumber}`;
        const publication: FakeReceiverPublication = {
          manifest: upload.manifest,
          body: {
            id: publicationId,
            projectId: "fake-project",
            state: "published",
            catalogueUrl: `${origin}/catalogues/${publicationId}`,
            viewerUrl: `${origin}/catalogues/${publicationId}/view`,
          },
        };
        publications.set(publicationKey(upload.manifest), publication);
        send(201, publication.body);
        return;
      }
      send(404);
    } finally {
      if (kind === "blob") activePuts--;
    }
  }

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("receiver address missing");
  origin = `http://127.0.0.1:${address.port}`;
  let closing: Promise<void> | undefined;
  const receiver: FakeReceiver = {
    blobs,
    control,
    endpoint: `${origin}${endpointPath}`,
    get maxConcurrentPuts() {
      return maxConcurrentPuts;
    },
    origin,
    plans,
    publications,
    puts,
    requests,
    close() {
      closing ??= new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeIdleConnections();
      });
      return closing;
    },
    dropBlob(digest) {
      blobs.delete(digest);
    },
    queue(kind, override) {
      const queue = overrides.get(kind) ?? [];
      queue.push({ ...override, remaining: override.times ?? 1 });
      overrides.set(kind, queue);
    },
  };
  context?.after(() => receiver.close());
  return receiver;
}
