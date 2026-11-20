import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import type { Page } from "@playwright/test";

import { installedRepository } from "./database-fixture";
import { legacyPublication } from "./legacy-publication";
import { apiOrigin } from "./origins";
import { repack } from "./publish-repack";

/** The release-owned contract fixture every publishing test uploads. */
export const fixture = resolve(
  process.cwd(),
  "../../crates/mkc-mokly-contract/fixtures/dogfood.tar.gz",
);

/** What one publication attempt claims about the work it carries. */
export interface PublishInput {
  branch?: string;
  headSha?: string;
  pullRequest?: number;
  /**
   * Name a file the upload does not carry, so admission refuses it. This is the
   * only way a browser test can put a real failed attempt in a branch's
   * history, which is where the reader meets one.
   */
  corrupt?: boolean;
  /**
   * Publish the current screens with nothing to compare them against, which is
   * how a first publication on a new branch arrives. The envelope names no
   * base and the index no comparison, the API reports `no-comparison`, and the
   * cloud API has no screen selections to offer.
   */
  currentOnly?: boolean;
  /**
   * The repository the upload claims to come from. Admission compares it with
   * the repository the project was created for, so it is the installed one
   * unless a test is about an upload that names another.
   */
  repository?: string;
  /**
   * Seed a legacy copy with this detail version after a valid upload.
   * The current receiver refuses these details, but an earlier publication
   * can still need a viewer version that the app does not support.
   */
  detailVersion?: 3;
  /** A CLI-built retained-evidence export; absent uses the frozen contract. */
  fixture?: string;
}

/** A 40-character head identity that is this test's alone. */
export function headSha(label: string): string {
  const stem = [...label].reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7);
  const noise = `${Math.abs(stem)}${Date.now()}${Math.floor(Math.random() * 1e9)}`;
  return noise
    .replace(/[^0-9]/g, "")
    .padEnd(40, "0")
    .slice(0, 40);
}

/** One attempt's plan archive and every file it may be asked for, by digest. */
export interface PublicationExport {
  plan: Buffer;
  blobs: Map<string, Buffer>;
}

/** The pinned contract fixture, with the envelope this attempt claims. */
export function publicationBody(input: PublishInput = {}): PublicationExport {
  const built = spawnSync(
    "python3",
    [
      "-c",
      repack,
      input.fixture ?? fixture,
      input.branch ?? "fixture",
      input.headSha ?? headSha(input.branch ?? "fixture"),
      input.pullRequest === undefined ? "" : String(input.pullRequest),
      input.corrupt ? "yes" : "no",
      input.currentOnly ? "yes" : "no",
      input.detailVersion === undefined ? "" : String(input.detailVersion),
      input.repository ?? installedRepository,
      resolve(process.cwd(), "../../scripts/cloud"),
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  if (built.status !== 0) {
    throw new Error(`repack failed: ${built.stderr.toString().slice(0, 500)}`);
  }
  const output = JSON.parse(built.stdout.toString()) as {
    plan: string;
    blobs: Record<string, string>;
  };
  return {
    plan: Buffer.from(output.plan, "base64"),
    blobs: new Map(
      Object.entries(output.blobs).map(([digest, data]) => [
        digest,
        Buffer.from(data, "base64"),
      ]),
    ),
  };
}

/** Create a publishing token through the API the reader's session authorizes. */
export async function createToken(
  page: Page,
  projectId: string,
): Promise<string> {
  return page.evaluate(
    async ([origin, id]) => {
      const session = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      const { csrfToken } = (await session.json()) as { csrfToken: string };
      const answer = await fetch(`${origin}/v1/projects/${id}/tokens`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ name: "Browser suite" }),
      });
      if (!answer.ok) throw new Error(`token failed: ${answer.status}`);
      return ((await answer.json()) as { secret: string }).secret;
    },
    [apiOrigin, projectId] as const,
  );
}

/** One publication, admitted by the real API exactly as the CLI publishes. */
export interface Published {
  id: string;
  catalogueUrl: string | null;
}

/** Completion receipt and actual HTTP status, for idempotence tests. */
export interface UploadResult extends Published {
  status: number;
  viewerUrl: string;
  state: string;
}

/**
 * Publish the contract fixture to one project, the way `mokly publish` uses
 * the API: a project token, the plan archive, the files the plan asks for and
 * the completion. A refused plan leaves a failed attempt, which is a row the
 * reader meets in history.
 */
export async function publish(
  token: string,
  projectId: string,
  input: PublishInput = {},
): Promise<Published> {
  const uploaded = await uploadBody(
    token,
    projectId,
    publicationBody({ ...input, detailVersion: undefined }),
  );
  if (!input.corrupt && uploaded.status >= 400) {
    throw new Error(`publish failed: ${uploaded.status}`);
  }
  const publication = { id: uploaded.id, catalogueUrl: uploaded.catalogueUrl };
  return input.detailVersion && !input.corrupt
    ? legacyPublication(publication, input.detailVersion)
    : publication;
}

/** The plan's answer: an attempt and the files this project still needs. */
interface Plan {
  missing: string[];
  blobUrl: string;
  completeUrl: string;
}

/** A URL from the plan, accepted only on the API origin, as the CLI requires. */
function onApiOrigin(url: string): string {
  if (new URL(url).origin !== apiOrigin) {
    throw new Error(`plan URL is outside the API origin: ${url}`);
  }
  return url;
}

/** Run one plan, blob and completion exchange; repeat it to prove idempotence. */
export async function uploadBody(
  token: string,
  projectId: string,
  exported: PublicationExport,
): Promise<UploadResult> {
  const authorization = "Bearer " + token;
  const planned = await fetch(
    `${apiOrigin}/v1/projects/${projectId}/publications`,
    {
      method: "POST",
      headers: { "content-type": "application/gzip", authorization },
      body: new Uint8Array(exported.plan),
    },
  );
  if (planned.status !== 200) return failed(planned.status);
  const plan = (await planned.json()) as Plan;
  for (const digest of plan.missing) {
    const bytes = exported.blobs.get(digest);
    if (!bytes) throw new Error(`plan asked for an unknown file: ${digest}`);
    const stored = await fetch(
      onApiOrigin(plan.blobUrl.replace("{sha256}", digest)),
      {
        method: "PUT",
        headers: { "content-type": "application/octet-stream", authorization },
        body: new Uint8Array(bytes),
      },
    );
    if (stored.status !== 204) return failed(stored.status);
  }
  const answer = await fetch(onApiOrigin(plan.completeUrl), {
    method: "POST",
    headers: { authorization },
  });
  if (answer.status !== 200 && answer.status !== 201) {
    return failed(answer.status);
  }
  const payload = (await answer.json()) as Partial<UploadResult>;
  return {
    id: payload.id ?? "",
    catalogueUrl: payload.catalogueUrl ?? null,
    viewerUrl: payload.viewerUrl ?? "",
    state: payload.state ?? "",
    status: answer.status,
  };
}

function failed(status: number): UploadResult {
  return { id: "", catalogueUrl: null, viewerUrl: "", state: "", status };
}
