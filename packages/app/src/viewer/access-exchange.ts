import type { postMessageAdapter } from "@mokly/viewer";

import { asApiError, unexpectedError } from "../api/errors";
import type { ApiError } from "../api/errors";
import { issueCatalogueGrant } from "../data/publications";

type AdapterOptions = Parameters<typeof postMessageAdapter>[0];
export type FrameAccess = Required<
  Pick<AdapterOptions, "access" | "onAccessFailure">
>;
type AccessToken = Awaited<ReturnType<FrameAccess["access"]>>;

export type CatalogueTransport = (
  url: URL,
  init: RequestInit,
) => Promise<Response>;

export const browserTransport: CatalogueTransport = (url, init) =>
  fetch(url, init);

export const accessStartPath = "mokly-viewer/client/access-start.html";

function bearerRequest(token: string): RequestInit {
  return { credentials: "omit", headers: { authorization: `Bearer ${token}` } };
}

export type PrivateAccessState =
  | {
      status: "granted";
      policy: "cookie" | "bearer";
      publication: PublicationAccess;
    }
  | { status: "refused"; error: ApiError }
  | { status: "blocked" };

interface Publication {
  projectId: string;
  publicationId: string;
  origin: string;
}

interface ExchangeTransport {
  issueGrant?: typeof issueCatalogueGrant;
  transport?: CatalogueTransport;
  now?: () => number;
}

interface ReadCredential {
  init: RequestInit;
  revision: number;
}

export interface PublicationAccess {
  confirm(): Promise<PrivateAccessState>;
  readCredential(
    policy: "cookie" | "bearer",
    rejectedRevision?: number,
  ): Promise<ReadCredential>;
  access: FrameAccess["access"];
}

const token68 = /^[A-Za-z0-9._~+/-]+=*$/;
const reuseAboveMs = 120_000;

async function readToken(
  response: Response,
  receivedAt: number,
): Promise<AccessToken | undefined> {
  // The browser can store the cookie from the headers even if the body is lost.
  const body: unknown = await response.json().catch(() => undefined);
  if (
    typeof body !== "object" ||
    body === null ||
    !("token" in body) ||
    typeof body.token !== "string" ||
    body.token.length > 4_096 ||
    !token68.test(body.token) ||
    !("expiresIn" in body) ||
    typeof body.expiresIn !== "number"
  ) {
    return undefined;
  }
  const expiresAt = receivedAt + body.expiresIn * 1_000;
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= receivedAt ||
    expiresAt <= 0
  ) {
    return undefined;
  }
  return { token: body.token, expiresAt };
}

/** The credential and the one exchange in flight for a publication attempt. */
export function createPublicationAccess(
  { projectId, publicationId, origin }: Publication,
  {
    issueGrant = issueCatalogueGrant,
    transport = browserTransport,
    now = Date.now,
  }: ExchangeTransport = {},
): PublicationAccess {
  let credential: { revision: number; token?: AccessToken } = { revision: 0 };
  let running: Promise<void> | undefined;

  async function exchangeGrant() {
    const grant = await issueGrant(projectId, publicationId);
    const accepted = await transport(new URL(grant.exchangeUrl), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant: grant.grant }),
    });
    if (!accepted.ok) throw unexpectedError();
    credential = {
      revision: credential.revision + 1,
      token: await readToken(accepted, now()),
    };
  }

  function renewCatalogueAccess(rejectedRevision = credential.revision) {
    if (rejectedRevision !== credential.revision) return Promise.resolve();
    running ??= exchangeGrant().finally(() => {
      running = undefined;
    });
    return running;
  }

  async function bearerCredential(
    reuseMarginMs: number,
    rejectedRevision?: number,
  ) {
    // A rejection of an older revision needs no exchange, but the current
    // token must still be usable; a missing or expired one renews first.
    const held = credential.token;
    if (
      rejectedRevision === credential.revision ||
      held === undefined ||
      held.expiresAt - now() <= reuseMarginMs
    ) {
      await renewCatalogueAccess();
    }
    const { token, revision } = credential;
    if (token === undefined || token.expiresAt <= now())
      throw unexpectedError();
    return { token, revision };
  }

  const publication: PublicationAccess = {
    async confirm() {
      try {
        await renewCatalogueAccess();
        const root = new URL("/", origin);
        const cookie = await transport(root, { credentials: "include" }).catch(
          () => undefined,
        );
        if (cookie?.ok) {
          return { status: "granted", policy: "cookie", publication };
        }
        const { token } = credential;
        if (token === undefined) throw unexpectedError();

        const bearer = bearerRequest(token.token);
        const start = await transport(
          new URL(accessStartPath, root),
          bearer,
        ).catch(() => undefined);
        if (start?.status === 404) return { status: "blocked" };
        if ((await transport(root, bearer)).ok) {
          return { status: "granted", policy: "bearer", publication };
        }
        throw unexpectedError();
      } catch (error) {
        return {
          status: "refused",
          error: asApiError(error) ?? unexpectedError(),
        };
      }
    },
    async readCredential(policy, rejectedRevision) {
      if (policy === "bearer") {
        const { token, revision } = await bearerCredential(0, rejectedRevision);
        return { init: bearerRequest(token.token), revision };
      }
      if (rejectedRevision !== undefined)
        await renewCatalogueAccess(rejectedRevision);
      return {
        init: { credentials: "include" },
        revision: credential.revision,
      };
    },
    async access() {
      const { token } = await bearerCredential(reuseAboveMs);
      return token;
    },
  };
  return publication;
}
