import type { Agent } from "node:http";
import { request } from "node:http";

import { validEntrySource } from "./fixture.js";

export function captureOutput(stream: NodeJS.ReadableStream): () => string {
  let output = "";
  stream.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  return () => output;
}

export async function readEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<string> {
  const decoder = new TextDecoder();
  let output = "";
  while (!output.includes("\n\n")) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error("event stream ended before an event");
    output += decoder.decode(chunk.value, { stream: true });
  }
  return output;
}

export function outputUrl(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(
      () => reject(new Error(`CLI readiness timed out: ${output}`)),
      15_000,
    );
    stream.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      const match = output.match(
        /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/,
      );
      if (match?.[1]) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
  });
}

export async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMilliseconds = 12_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch {
      // The watched child may be between close and readiness on its stable port.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("watched condition did not become true");
}

export function sourceWithHomeRoute(route: string, title: string): string {
  const id = route.slice(0, -"/index.html".length);
  return validEntrySource({ firstTitle: title })
    .replace('path: "home"', `path: ${JSON.stringify(id)}`)
    .replace('screenPath: "home"', `screenPath: ${JSON.stringify(id)}`);
}

export async function streamEnded(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const drain = async (): Promise<boolean> => {
    while (true) {
      const result = await reader.read();
      if (result.done) return true;
    }
  };
  try {
    return await Promise.race([
      drain(),
      new Promise<boolean>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("watched child did not restart")),
          12_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function nodeRequest(
  url: string,
  method: "GET" | "HEAD",
  agent: Agent,
): Promise<{ body: string; status: number | undefined }> {
  return new Promise((resolve, reject) => {
    const request_ = request(url, { agent, method }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.once("end", () =>
        resolve({ body, status: response.statusCode }),
      );
    });
    request_.setTimeout(2_000, () =>
      request_.destroy(new Error(`${method} ${url} timed out`)),
    );
    request_.once("error", reject);
    request_.end();
  });
}
