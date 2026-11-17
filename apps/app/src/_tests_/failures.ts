import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { repositoryRoot } from "./root";

import type { ApiCode } from "../api/errors";
import type { ApiReason } from "../api/reasons";

/** How the API answers one reason: with this code, at this status. */
export interface CataloguedFailure {
  code: ApiCode;
  status: number;
}

const table = /^\|\s*`([a-z-]+)`\s*\|\s*`([a-z-]+)`\s*\|\s*(\d{3})\s*\|/gm;

/**
 * Every failure the API can send, read from the protocol's own table.
 *
 * A fixture that named its own code could describe an answer the server has no
 * way to produce — and has twice — so the pairing is taken from the contract
 * rather than from care. The contract test asserts the reasons here are the
 * reasons the client knows, so the table cannot drift away from either.
 */
export function cataloguedFailures(): Map<string, CataloguedFailure> {
  const source = readFileSync(
    resolve(repositoryRoot, "docs/protocol/cloud/rest-api.md"),
    "utf8",
  );
  const found = new Map<string, CataloguedFailure>();
  for (const [, reason, code, status] of source.matchAll(table)) {
    found.set(reason, { code: code as ApiCode, status: Number(status) });
  }
  return found;
}

/** What the API answers for one reason, as the protocol records it. */
export function failureFor(reason: ApiReason): CataloguedFailure {
  const catalogued = cataloguedFailures().get(reason);
  if (!catalogued) {
    throw new Error(`[app/tests] ${reason} is not in the rest-api.md table`);
  }
  return catalogued;
}
