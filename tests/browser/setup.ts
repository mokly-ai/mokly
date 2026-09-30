import type { FullConfig } from "@playwright/test";

import { waitForInitialChanges } from "../helpers/watched_catalogue.js";

/** Wait for the example's tree-owned HEAD comparison to reach a terminal state. */
export default async function setup(config: FullConfig): Promise<void> {
  const url = config.projects[0]?.use.baseURL;
  if (!url) throw new Error("The browser suite needs its example base URL");
  await waitForInitialChanges(url, 180_000);
}
