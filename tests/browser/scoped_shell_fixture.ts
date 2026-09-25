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
  const response = await route.fetch();
  const body = await response.text();
  await route.fulfill({ response, body: scopedShellHtml(body, target) });
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
