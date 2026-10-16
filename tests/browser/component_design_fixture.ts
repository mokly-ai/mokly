import type { CatalogueReadModel } from "@mokly/viewer";

import { test } from "./browser_test.js";
import { ownExampleServerUrl } from "./example_servers.js";

export const componentDesignRoutes: string[] = [];

test.beforeAll(async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/mokly-viewer/index.json`);
  const index = (await response.json()) as CatalogueReadModel;
  componentDesignRoutes.splice(
    0,
    componentDesignRoutes.length,
    ...index.screens
      .filter((entry) => entry.path.startsWith("design/components/"))
      .map((entry) => entry.path),
  );
  if (!componentDesignRoutes.length)
    throw new Error("No component design screens");
});

export function componentDesignUrl(
  entryPath: string,
  viewport: string,
): string {
  const origin = ownExampleServerUrl();
  if (!origin) throw new Error("The browser example server is not ready");
  return `${origin}/static/mokly-generated/${entryPath}/index.${viewport}.html`;
}
