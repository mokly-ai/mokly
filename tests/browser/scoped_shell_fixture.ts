import type { Route } from "@playwright/test";

import { projectScopedCatalogue } from "../../packages/viewer/dist/runtime.js";
import type { CatalogueUsageScopeTarget } from "../../packages/viewer/dist/runtime.js";
import {
  readShellBootstrap,
  serializeShellBootstrap,
} from "../../packages/viewer/dist/standalone/bootstrap.js";

const BOOTSTRAP_SCRIPT =
  /(<script\b[^>]*\bdata-mokly-shell-bootstrap=""[^>]*>)([^<]+)(<\/script>)/u;

/** Fulfil one Serve page after replacing its complete bootstrap with exact scope. */
export async function fulfillScopedShell(
  route: Route,
  target?: CatalogueUsageScopeTarget,
): Promise<void> {
  const documentRequest = route.request().resourceType() === "document";
  const response = await route.fetch();
  const body = await response.text();
  try {
    await route.fulfill({ response, body: scopedShellHtml(body, target) });
  } catch (error) {
    if (!documentRequest && isRouteAlreadyHandled(error)) {
      await settleCancelledRoute(route);
      return;
    }
    throw error;
  }
}

/** Project the embedded bootstrap without changing any server-rendered markup. */
export function scopedShellHtml(
  html: string,
  target?: CatalogueUsageScopeTarget,
): string {
  const match = BOOTSTRAP_SCRIPT.exec(html);
  if (!match) throw new Error("Serve page has no shell bootstrap.");
  const bootstrap = readShellBootstrap(JSON.parse(match[2]!));
  const scoped = {
    ...bootstrap,
    catalogue: projectScopedCatalogue(
      bootstrap.catalogue,
      target ?? bootstrap.view,
    ),
  };
  return html.replace(
    BOOTSTRAP_SCRIPT,
    (_script, open: string, _json: string, close: string) =>
      `${open}${serializeShellBootstrap(scoped)}${close}`,
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
