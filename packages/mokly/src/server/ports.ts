import type http from "node:http";

import { MoklyError, errorMessage } from "../errors.js";

const MAX_PORT = 65_535;

/** Bind from the requested port, advancing past occupied ports when allowed. */
export async function listenOnAvailablePort(
  server: http.Server,
  requestedPort: number,
  strictPort: boolean,
): Promise<void> {
  let port = requestedPort;
  while (true) {
    try {
      await listen(server, port);
      return;
    } catch (error) {
      if (!strictPort && port > 0 && port < MAX_PORT && isInUse(error)) {
        port += 1;
        continue;
      }
      throw new MoklyError(
        "server-failed",
        `could not bind port ${port}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
}

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      server.off("error", onError);
      server.off("listening", onListening);
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const onListening = (): void => {
      cleanup();
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    try {
      server.listen(port, "127.0.0.1");
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function isInUse(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && error.code === "EADDRINUSE"
  );
}
