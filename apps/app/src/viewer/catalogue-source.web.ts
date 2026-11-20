import type { CatalogueReadModel, EntryDetailV4 } from "@mokly/viewer";

import { renewCatalogueAccess } from "./access";
import type { SourceReads } from "./source-store";

/**
 * The package's public readers. The package ships only an ES module, so the
 * readers load through `import()`, which the logic tests can also run.
 */
const viewer = () => import("@mokly/viewer");

/** The small fetch shape the catalogue reads use and their focused tests stub. */
export type CatalogueTransport = (
  url: URL,
  init: RequestInit,
) => Promise<Response>;

const browserTransport: CatalogueTransport = (url, init) => fetch(url, init);

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

/** A catalogue read that another origin or an unsuccessful status answered. */
export class CatalogueReadError extends Error {
  /** The status of a same-origin answer; absent for another origin's. */
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

/**
 * One JSON read with the source's credential policy: the cookie only for a
 * private catalogue, and only the publication's own host may answer.
 */
async function readJson(
  url: URL,
  root: URL,
  credentialed: boolean,
  transport: CatalogueTransport,
): Promise<unknown> {
  const response = await transport(url, {
    credentials: credentialed ? "include" : "omit",
  });
  if (!sameOrigin(response, root)) throw new CatalogueReadError();
  if (!response.ok) throw new CatalogueReadError(response.status);
  const value: unknown = await response.json();
  return value;
}

/** Read one publication's catalogue index v9 through the public reader. */
export async function readIndex(
  root: URL,
  credentialed: boolean,
  transport: CatalogueTransport = browserTransport,
): Promise<CatalogueReadModel> {
  const value = await readJson(indexUrl(root), root, credentialed, transport);
  const { readCatalogueIndex } = await viewer();
  return readCatalogueIndex(value);
}

/** What one detail source reads with. */
export interface DetailReads {
  root: URL;
  credentialed: boolean;
  index: CatalogueReadModel;
  /** The access exchange again, which a private read runs after a 401. */
  renew: () => Promise<void>;
  transport?: CatalogueTransport;
}

function unauthorized(error: unknown): boolean {
  return error instanceof CatalogueReadError && error.status === 401;
}

/** One entry's version-checked detail, as the package's `detail` source answers. */
export type DetailRead = (
  path: string,
  snapshotId?: string,
) => Promise<EntryDetailV4>;

/**
 * The package's `detail` source. A private read that answers 401 runs the
 * access exchange once more and repeats the read once, because the catalogue
 * cookie lives 300 seconds and details load during navigation.
 */
export function detailSource(reads: DetailReads): DetailRead {
  const transport = reads.transport ?? browserTransport;
  const read = (url: URL) =>
    readJson(url, reads.root, reads.credentialed, transport);
  return async (path, snapshotId) => {
    const url = detailUrl(reads.root, reads.index, path, snapshotId);
    let value: unknown;
    try {
      value = await read(url);
    } catch (error) {
      if (!reads.credentialed || !unauthorized(error)) throw error;
      await reads.renew();
      value = await read(url);
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
          index: await readIndex(root, request.credentialed, transport),
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
    detail(request, index, renew) {
      return detailSource({
        root: catalogueArtifactOrigin(request.origin),
        credentialed: request.credentialed,
        index,
        renew,
        transport,
      });
    },
    renew(request) {
      return renewCatalogueAccess(request.projectId, request.publicationId);
    },
  };
}
