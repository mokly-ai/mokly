import type { CatalogueReadModel, EntryDetailV4 } from "@mokly/viewer";

import { bearerRequest, browserTransport } from "./access-exchange";
import type { CatalogueTransport } from "./access-exchange";
import type { SourceAccess, SourceReads } from "./source-store";

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

function readRequest(access: SourceAccess): RequestInit {
  if (access.policy === "bearer") {
    const token = access.publication.currentToken();
    if (token === undefined) throw new CatalogueReadError();
    return bearerRequest(token);
  }
  return { credentials: access.policy === "cookie" ? "include" : "omit" };
}

/** One JSON read with the credential confirmed by this publication's host. */
async function readJson(
  url: URL,
  root: URL,
  access: SourceAccess,
  transport: CatalogueTransport,
): Promise<unknown> {
  if (url.origin !== root.origin) throw new CatalogueReadError();
  const response = await transport(url, readRequest(access));
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
  access: () => SourceAccess;
  index: CatalogueReadModel;
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
 * credential lives 300 seconds and details load during navigation.
 */
export function detailSource(reads: DetailReads): DetailRead {
  const transport = reads.transport ?? browserTransport;
  return async (path, snapshotId) => {
    const access = reads.access();
    const url = detailUrl(reads.root, reads.index, path, snapshotId);
    const read = () => readJson(url, reads.root, access, transport);
    let value: unknown;
    try {
      value = await read();
    } catch (error) {
      if (access.policy === "public" || !unauthorized(error)) throw error;
      await access.publication.renewCatalogueAccess();
      value = await read();
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
    detail(request, index) {
      return detailSource({
        root: catalogueArtifactOrigin(request().origin),
        access: () => request().access,
        index,
        transport,
      });
    },
  };
}
