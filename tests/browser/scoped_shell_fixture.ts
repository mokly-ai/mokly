import type { Route } from "@playwright/test";

import type { CatalogueUsageScopeTarget } from "../../packages/viewer/dist/runtime.js";
import {
  readScopedShellBootstrap,
  serializeShellBootstrap,
} from "../../packages/viewer/dist/runtime.js";

const BOOTSTRAP_SCRIPT =
  /(<script\b[^>]*\bdata-mokly-shell-bootstrap=""[^>]*>)([^<]+)(<\/script>)/u;

/** Fulfil one native scoped Serve page, optionally corrupting only its view. */
export async function fulfillScopedShell(
  route: Route,
  target?: CatalogueUsageScopeTarget,
): Promise<void> {
  const documentRequest = route.request().resourceType() === "document";
  const response = await route.fetch();
  const body = await response.text();
  try {
    await route.fulfill({
      response,
      body: target ? mismatchedScopedShellHtml(body, target) : body,
    });
  } catch (error) {
    if (!documentRequest && isRouteAlreadyHandled(error)) {
      await settleCancelledRoute(route);
      return;
    }
    throw error;
  }
}

/** Create a rejected candidate without synthesizing a replacement catalogue. */
function mismatchedScopedShellHtml(
  html: string,
  target: CatalogueUsageScopeTarget,
): string {
  const match = BOOTSTRAP_SCRIPT.exec(html);
  if (!match) throw new Error("Serve page has no shell bootstrap.");
  const bootstrap = readScopedShellBootstrap(JSON.parse(match[2]!));
  const mismatched = { ...bootstrap, view: target };
  return html.replace(
    BOOTSTRAP_SCRIPT,
    (_script, open: string, _json: string, close: string) =>
      `${open}${serializeShellBootstrap(mismatched)}${close}`,
  );
}

async function settleCancelledRoute(route: Route): Promise<void> {
  try {
    await route.fallback();
  } catch (error) {
    if (!isRouteAlreadyHandled(error)) throw error;
  }
}

function isRouteAlreadyHandled(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("message" in error) ||
    typeof error.message !== "string"
  )
    return false;
  const [message] = error.message.split("\n", 1);
  return /^(?:Error: )?(?:route\.(?:fulfill|fallback): )?Route is already handled!$/u.test(
    message ?? "",
  );
}
