import type { CatalogueReadModel } from "@mokly/viewer";

import { browserTransport } from "./access-exchange";
import type { CatalogueTransport } from "./access-exchange";
import type { DetailRead, SourceAccess, SourceReads } from "./source-store";

/**
 * The package's public readers. The package ships only an ES module, so the
 * readers load through `import()`, which the logic tests can also run.
 */
const viewer = () => import("@mokly/viewer");

/** Validate and canonicalize the API-supplied per-publication origin. */
export function catalogueArtifactOrigin(value: string): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== "/" ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error("The catalogue address is unavailable.");
  }
  return new URL(url.origin + "/");
}

/**
 * The index and detail paths of `docs/protocol/cloud/viewer-catalogue.md`, restated
 * here once because `@mokly/viewer/data` exports no detail path function.
 */
function indexUrl(root: URL): URL {
  return new URL("mokly-viewer/index.json", root);
}

function entryFile(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/") + ".json";
}

/**
 * A current entry's detail, or a removed entry's detail beneath the
 * comparison generation that the index's `comparisonUrl` names.
 */
function detailUrl(
  root: URL,
  index: CatalogueReadModel,
  path: string,
  snapshotId?: string,
): URL {
  if (snapshotId === undefined) {
    return new URL(`mokly-viewer/entries/${entryFile(path)}`, root);
  }
  if (index.comparisonUrl === null) {
    throw new Error("This catalogue has no previous versions.");
  }
  return new URL(
    `entries/${entryFile(path)}`,
    new URL(index.comparisonUrl, root),
  );
}

/** An off-origin request or response, or an unsuccessful reply from the publication. */
export class CatalogueReadError extends Error {
  /** Present only when the publication origin returned an unsuccessful status. */
  readonly status: number | undefined;

  constructor(status?: number) {
    super("The catalogue could not be loaded.");
    this.name = "CatalogueReadError";
    this.status = status;
  }
}

function sameOrigin(response: Response, root: URL): boolean {
  try {
    const final = new URL(response.url);
    return (
      ["http:", "https:"].includes(final.protocol) &&
      final.username.length === 0 &&
      final.password.length === 0 &&
      final.origin === root.origin
    );
  } catch {
    return false;
  }
}

/** One JSON read with the credential confirmed by this publication's host. */
async function readJson(
  url: URL,
  root: URL,
  access: SourceAccess,
  transport: CatalogueTransport,
  renew = false,
): Promise<unknown> {
  if (url.origin !== root.origin) throw new CatalogueReadError();
  const init: RequestInit =
    access.policy === "public"
      ? { credentials: "omit" }
      : await access.publication.readCredential(access.policy, renew);
  const response = await transport(url, init);
  if (!sameOrigin(response, root)) throw new CatalogueReadError();
  if (!response.ok) throw new CatalogueReadError(response.status);
  const value: unknown = await response.json();
  return value;
}

/** Read one publication's catalogue index v9 through the public reader. */
export async function readIndex(
  root: URL,
  access: SourceAccess,
  transport: CatalogueTransport = browserTransport,
): Promise<CatalogueReadModel> {
  const value = await readJson(indexUrl(root), root, access, transport);
  const { readCatalogueIndex } = await viewer();
  return readCatalogueIndex(value);
}

/** What one detail source reads with. */
export interface DetailReads {
  root: URL;
  index: CatalogueReadModel;
  transport?: CatalogueTransport;
}

/** A private detail read renews access after a 401 and retries once. */
export function detailSource(reads: DetailReads): DetailRead {
  const transport = reads.transport ?? browserTransport;
  return async (access, path, snapshotId) => {
    const url = detailUrl(reads.root, reads.index, path, snapshotId);
    let value: unknown;
    try {
      value = await readJson(url, reads.root, access, transport);
    } catch (error) {
      if (
        access.policy === "public" ||
        !(error instanceof CatalogueReadError) ||
        error.status !== 401
      ) {
        throw error;
      }
      value = await readJson(url, reads.root, access, transport, true);
    }
    const { readEntryDetail } = await viewer();
    return readEntryDetail(value);
  };
}

/** The reads of the web document's catalogue sources. */
export function catalogueReads(
  transport: CatalogueTransport = browserTransport,
): SourceReads {
  return {
    async index(request) {
      try {
        const root = catalogueArtifactOrigin(request.origin);
        return {
          index: await readIndex(root, request.access, transport),
        };
      } catch (error) {
        // The reader's typed failure is preserved for the version card, with
        // the package's plain diagnostic for its Details.
        const { MoklyVersionError } = await viewer();
        if (error instanceof MoklyVersionError) {
          return { failure: { details: error.message } };
        }
        throw error;
      }
    },
    detail(origin, index) {
      return detailSource({
        root: catalogueArtifactOrigin(origin),
        index,
        transport,
      });
    },
  };
}
