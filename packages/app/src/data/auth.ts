import {
  api,
  correlationHeader,
  expectBody,
  mutationHeaders,
  originHeader,
} from "../api/client";
import type {
  Configuration,
  Connection,
  DesktopGrantCallback,
  DesktopGrantRequest,
  DesktopGrantResult,
  MagicLinkResult,
  PreviewSignIn,
  SessionIssued,
  User,
} from "../api/types";

/**
 * Read which optional configuration the API has, such as the shared account
 * that the preview password signs in. It needs no session.
 */
export function readConfiguration(): Promise<Configuration> {
  return expectBody((id) =>
    api.GET("/v1/configuration", { headers: correlationHeader(id) }),
  );
}

/** Ask the API to send a sign-in link; the answer never reveals an account. */
export function sendMagicLink(input: {
  email: string;
  returnTo?: string;
}): Promise<MagicLinkResult> {
  return expectBody((id) =>
    api.POST("/v1/auth/magic-links", {
      params: { header: originHeader() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Consume a one-use link, issuing the session cookie and its destination. */
export function verifyMagicLink(token: string): Promise<SessionIssued> {
  return expectBody((id) =>
    api.POST("/v1/auth/callback", {
      params: { header: originHeader() },
      headers: correlationHeader(id),
      body: { token },
    }),
  );
}

/**
 * Exchange the preview password for a session of the shared account, issuing
 * the session cookie and its destination.
 */
export function exchangePreviewPassword(
  input: PreviewSignIn,
): Promise<SessionIssued> {
  return expectBody((id) =>
    api.POST("/v1/auth/preview", {
      params: { header: originHeader() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/**
 * Ask for a one-use grant that signs the desktop app in to this browser's
 * account, bound to the challenge of the window's verifier.
 */
export function issueDesktopGrant(
  input: DesktopGrantRequest,
): Promise<DesktopGrantResult> {
  return expectBody((id) =>
    api.POST("/v1/auth/desktop/grants", {
      params: { header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Exchange a desktop grant and the window's verifier for the window's session. */
export function exchangeDesktopGrant(
  input: DesktopGrantCallback,
): Promise<SessionIssued> {
  return expectBody((id) =>
    api.POST("/v1/auth/desktop/callback", {
      params: { header: originHeader() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Start GitHub sign-in without requiring an existing Mokly session. */
export function startGitHubSignIn(returnTo: string): Promise<Connection> {
  return expectBody((id) =>
    api.POST("/v1/auth/github", {
      params: { header: originHeader() },
      headers: correlationHeader(id),
      body: { returnTo },
    }),
  );
}

/** Start GitHub identity authorization for the signed-in account. */
export function connectGitHub(returnTo: string): Promise<Connection> {
  return expectBody((id) =>
    api.POST("/v1/github/connection", {
      params: { header: mutationHeaders() },
      headers: correlationHeader(id),
      body: { returnTo },
    }),
  );
}

/**
 * Start App installation for a workspace the reader administers. Without a
 * candidate the answer is GitHub's install page; with `installationId`, an
 * installation that arrived from GitHub with no flow behind it, the flow
 * starts with that candidate recorded and the answer is GitHub's
 * authorization page.
 */
export function installGitHubApp(input: {
  workspaceId: string;
  returnTo: string;
  installationId?: number;
}): Promise<Connection> {
  return expectBody((id) =>
    api.POST("/v1/github/installations", {
      params: { header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Exchange a GitHub user callback, with CSRF for session-bound purposes. */
export function verifyGitHubCallback(
  input: { code: string; state: string; codeVerifier: string },
  sessionBound: boolean,
): Promise<SessionIssued> {
  return expectBody((id) =>
    api.POST("/v1/auth/github/callback", {
      params: {
        header: sessionBound ? mutationHeaders() : originHeader(),
      },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Validate a GitHub App setup return and start its user authorization. */
export function completeGitHubInstallation(input: {
  installationId: number;
  state: string;
  codeVerifier: string;
}): Promise<Connection> {
  return expectBody((id) =>
    api.POST("/v1/github/installations/callback", {
      params: { header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Change the signed-in person's display name. */
export function updateAccount(name: string): Promise<User> {
  return expectBody((id) =>
    api.PATCH("/v1/account", {
      params: { header: mutationHeaders() },
      headers: correlationHeader(id),
      body: { name },
    }),
  );
}
