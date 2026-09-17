import type { Server, ServerResponse } from "node:http";

/** Drain every owned service even when one resource fails to close. */
export async function closeCatalogueHttp(
  server: Server,
  streams: ReadonlySet<ServerResponse>,
  services: readonly ({ close(): Promise<void> } | undefined)[],
): Promise<void> {
  for (const stream of streams) stream.end();
  const serverClosing = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  const results = await Promise.allSettled([
    serverClosing,
    ...services.map((service) => service?.close()),
  ]);
  for (const result of results)
    if (result.status === "rejected") throw result.reason;
}
