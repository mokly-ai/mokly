import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { CatalogueTransport } from "../../viewer/access-exchange";
import { readIndex } from "../../viewer/catalogue-source.web";
import type { SourceAccess } from "../../viewer/source-store";
import { repositoryRoot } from "../root";

import { removed } from "./fixtures";

const fixtures = repositoryRoot + "/docs/protocol/fixtures/";
export const indexFile: unknown = JSON.parse(
  readFileSync(fixtures + "catalogue-v9.json", "utf8"),
);
const detailFiles: unknown = JSON.parse(
  readFileSync(fixtures + "entry-details-v4.json", "utf8"),
);
export const root = new URL("https://p-publication.example/");
export const indexPath = "/mokly-viewer/index.json";
export const guidePath = "/mokly-viewer/entries/guide.json";

/** One member of a fixture object, read without asserting its type. */
function member(value: unknown, key: string): unknown {
  assert.ok(typeof value === "object" && value !== null, key);
  const found: unknown = Reflect.get(value, key);
  return found;
}

export const current = (path: string) =>
  member(member(detailFiles, "current"), path);
export const removedDetail = member(
  member(detailFiles, "removed"),
  removed.snapshotId,
);

export function response(url: string, status: number, body: unknown) {
  const value = Response.json(body, { status });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

/** The publication host's JSON and each path's scripted refusals. */
export function host(
  files: Record<string, unknown>,
  refusals: Record<string, number[]> = {},
) {
  const calls: Array<{
    path: string;
    credentials?: RequestCredentials;
    authorization: string | null;
  }> = [];
  const transport: CatalogueTransport = async (url, init) => {
    calls.push({
      path: url.pathname,
      credentials: init.credentials,
      authorization: new Headers(init.headers).get("authorization"),
    });
    const refused = refusals[url.pathname]?.shift();
    if (refused !== undefined) return response(url.href, refused, {});
    return response(url.href, 200, files[url.pathname]);
  };
  return { calls, transport };
}

export const publicAccess = { policy: "public" } as const;

export function cookieAccess(
  renewCatalogueAccess: () => Promise<void> = async () =>
    assert.fail("unexpected renewal"),
): SourceAccess {
  return {
    policy: "cookie",
    publication: {
      currentToken: () => assert.fail("cookie reads do not use a token"),
      renewCatalogueAccess,
    },
  };
}

/** The packaged index, read the way the host reads every index. */
export function packagedIndex() {
  return readIndex(
    root,
    publicAccess,
    host({ [indexPath]: indexFile }).transport,
  );
}
