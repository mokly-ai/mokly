import type { CatalogueReadModel, EntryDetailV4 } from "@mokly/viewer";

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
        ).json()) as EntryDetailV4;
        if (detail.views.some((view) => view.usage.status === "unavailable"))
          throw new Error(`Example render unavailable: ${entry.path}`);
        if (
          detail.revision !== index.revision ||
          detail.views.some((view) => view.usage.status === "pending")
        )
          ready = false;
        const record = [...index.screens, ...index.components].find(
          (candidate) => candidate.path === entry.path,
        );
        if (detail.detailId !== record?.detailId) ready = false;
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
