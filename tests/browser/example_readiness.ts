import type { CatalogueReadModel, EntryDetailV1 } from "@mokly/viewer";

/** Wait for the initial usage batch through publication events, without sleeps. */
export async function exampleReady(
  url: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(`${url}/mokly-viewer/events`, { signal });
  if (!response.ok || !response.body)
    throw new Error("Example publication stream is unavailable");
  const stream = response.body.getReader();
  try {
    for (;;) {
      const index = (await (
        await request(`${url}/mokly-viewer/index.json`, { signal })
      ).json()) as CatalogueReadModel;
      let ready = !["pending", "preparing"].includes(index.changesStatus);
      for (const entry of [...index.screens, ...index.components]) {
        const detail = (await (
          await request(`${url}/mokly-viewer/entries/${entry.path}.json`, {
            signal,
          })
        ).json()) as EntryDetailV1;
        if (detail.views.some((view) => view.usage.status === "unavailable"))
          throw new Error(`Example render unavailable: ${entry.path}`);
        if (
          detail.revision !== index.revision ||
          detail.views.some((view) => view.usage.status === "pending")
        )
          ready = false;
      }
      if (ready) {
        if (index.changesStatus !== "unavailable")
          throw new Error("Shared example Changes must be unavailable");
        return;
      }
      if ((await stream.read()).done)
        throw new Error("Example publication stream ended before readiness");
    }
  } finally {
    await stream.cancel();
  }
}
