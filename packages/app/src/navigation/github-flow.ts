import type { Connection } from "../api/types";

import { parseInstallationId } from "./installation-id";
import { one } from "./provider-query";

/** The provider round trips that can be in flight in one browser tab. */
export type GitHubFlowPurpose =
  "sign-in" | "connect" | "install-setup" | "install-authorize";

/** Stable tab-scoped storage keys for each GitHub provider round trip. */
export const githubFlowKeys: Record<GitHubFlowPurpose, string> = {
  "sign-in": "mkc:github-flow:sign-in",
  connect: "mkc:github-flow:connect",
  "install-setup": "mkc:github-flow:install-setup",
  "install-authorize": "mkc:github-flow:install-authorize",
};

interface StoredFlow {
  state: string;
  codeVerifier: string;
}

/** A validated GitHub identity callback, or a local refusal with no request. */
export type GitHubCallbackAttempt =
  | {
      status: "valid";
      purpose: "sign-in" | "connect" | "install-authorize";
      code: string;
      state: string;
      codeVerifier: string;
    }
  | {
      status: "refused";
      purpose: "sign-in" | "connect" | "install-authorize";
    }
  | { status: "invalid" };

/**
 * A validated GitHub App setup return, a request an owner of the GitHub
 * organization still has to approve, or a local refusal with no request.
 */
export type GitHubInstallationAttempt =
  | {
      status: "valid";
      installationId: number;
      state: string;
      codeVerifier: string;
    }
  | { status: "requested" }
  | { status: "invalid" };

const purposes = Object.keys(githubFlowKeys) as GitHubFlowPurpose[];
const callbackPurposes = ["sign-in", "connect", "install-authorize"] as const;
const credential = /^[0-9a-f]{64}$/;

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function remove(
  storage: Storage,
  selected: readonly GitHubFlowPurpose[],
): void {
  for (const purpose of selected) {
    try {
      storage.removeItem(githubFlowKeys[purpose]);
    } catch {
      // An unavailable browser store is handled as an invalid local flow.
    }
  }
}

function stored(
  storage: Storage,
  purpose: GitHubFlowPurpose,
): StoredFlow | undefined {
  let raw: string | null;
  try {
    raw = storage.getItem(githubFlowKeys[purpose]);
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;
  try {
    const value = JSON.parse(raw) as Partial<StoredFlow> | null;
    if (
      value === null ||
      typeof value !== "object" ||
      typeof value.state !== "string" ||
      typeof value.codeVerifier !== "string" ||
      !credential.test(value.state) ||
      !credential.test(value.codeVerifier)
    ) {
      return undefined;
    }
    return { state: value.state, codeVerifier: value.codeVerifier };
  } catch {
    return undefined;
  }
}

/**
 * Replace every prior GitHub trip in this tab with the provider values the API
 * just issued. A caller only leaves for GitHub after this returns true.
 */
export function storeGitHubFlow(
  purpose: GitHubFlowPurpose,
  connection: Connection,
): boolean {
  const storage = browserStorage();
  if (storage === undefined) return false;
  remove(storage, purposes);
  if (
    !credential.test(connection.state) ||
    !credential.test(connection.codeVerifier)
  ) {
    return false;
  }
  try {
    storage.setItem(
      githubFlowKeys[purpose],
      JSON.stringify({
        state: connection.state,
        codeVerifier: connection.codeVerifier,
      }),
    );
    return true;
  } catch {
    remove(storage, purposes);
    return false;
  }
}

/**
 * Consume one identity callback's query, as the landing captured it, and the
 * matching tab record. Invalid, duplicate or ambiguous input never reaches the
 * API.
 */
export function consumeGitHubCallback(
  input: URLSearchParams,
): GitHubCallbackAttempt {
  const storage = browserStorage();
  if (storage === undefined) return { status: "invalid" };

  const state = one(input, "state");
  const candidates = callbackPurposes.flatMap((purpose) => {
    const flow = stored(storage, purpose);
    return flow === undefined ? [] : [{ purpose, flow }];
  });
  remove(storage, callbackPurposes);
  if (state === undefined || !credential.test(state)) {
    return { status: "invalid" };
  }
  const matches = candidates.filter(({ flow }) => flow.state === state);
  if (matches.length !== 1) return { status: "invalid" };
  const [{ purpose, flow }] = matches;
  const codeValues = input.getAll("code");
  const code = one(input, "code");
  if (input.has("error") || codeValues.length === 0) {
    return { status: "refused", purpose };
  }
  if (code === undefined || code.length > 1024) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    purpose,
    code,
    state,
    codeVerifier: flow.codeVerifier,
  };
}

/**
 * Consume one installation setup return's query, as the landing captured it,
 * and its tab-scoped verifier. The advisory `setup_action` query is read only
 * to recognize a request waiting for approval, which sends nothing anywhere;
 * it is never read for authority. A request still ends the tab's setup trip,
 * so a reload cannot replay it.
 */
export function consumeGitHubInstallation(
  input: URLSearchParams,
): GitHubInstallationAttempt {
  const storage = browserStorage();
  const requested = one(input, "setup_action") === "request";
  if (storage === undefined) {
    return requested ? { status: "requested" } : { status: "invalid" };
  }

  const installationId = parseInstallationId(one(input, "installation_id"));
  const state = one(input, "state");
  const flow = stored(storage, "install-setup");
  remove(storage, ["install-setup"]);
  if (requested) return { status: "requested" };
  if (
    installationId === undefined ||
    state === undefined ||
    !credential.test(state) ||
    flow === undefined ||
    flow.state !== state
  ) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    installationId,
    state,
    codeVerifier: flow.codeVerifier,
  };
}

/**
 * The installation a setup return names when no setup trip of this tab stands
 * behind it: a positive `installation_id`, not a request waiting for approval,
 * which is drawn as one, and no `state` that matches the tab's setup record.
 * Such a return comes from Redirect on update, from an install started on
 * GitHub, or from a GitHub page that kept the `state` of a trip that has since
 * ended or been replaced. The landing hands it to the connect situation, which
 * proves administration of the account again, rather than to the API. A
 * matching record is left for the landing to consume.
 */
export function installationToConnect(
  input: URLSearchParams,
): number | undefined {
  if (one(input, "setup_action") === "request") return undefined;
  const installationId = parseInstallationId(one(input, "installation_id"));
  if (installationId === undefined) return undefined;
  const state = one(input, "state");
  const storage = browserStorage();
  const flow = storage && stored(storage, "install-setup");
  return state !== undefined && flow?.state === state
    ? undefined
    : installationId;
}
