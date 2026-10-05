/** Generation-bound diagnostics route for browser render failures. */

import type { IncomingMessage, ServerResponse } from "node:http";

import {
  InteractiveDiagnosticInputError,
  InteractiveDiagnosticRequestError,
  interactiveDiagnosticLine,
  interactiveDiagnosticViewKey,
  readInteractiveDiagnostic,
} from "./diagnostics.js";
import type { InteractiveGeneration } from "./generation.js";
import { sendInteractive } from "./responses.js";

interface InteractiveDiagnosticRequest {
  context?: InteractiveGeneration;
  generation: string;
  method: string;
  onDiagnostic(error: unknown): void;
  reported: Set<string>;
  request: IncomingMessage;
  response: ServerResponse;
}

/** Strictly validate, deduplicate and log one browser diagnostic. */
export async function serveInteractiveDiagnostic(
  input: InteractiveDiagnosticRequest,
): Promise<void> {
  const { context, generation, method, request, response } = input;
  if (method !== "POST") return failure(response, method, 405);
  if (!context) return failure(response, method, 404);
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers["content-type"] ?? "",
    )
  )
    return failure(response, method, 415);
  try {
    const diagnostic = await readInteractiveDiagnostic(request);
    if (
      diagnostic.entryPath &&
      ![...context.views.values()].some(
        (view) =>
          view.entryPath === diagnostic.entryPath &&
          view.variantPath === diagnostic.variantPath &&
          view.viewport === diagnostic.viewport &&
          view.colorScheme === diagnostic.colorScheme,
      )
    )
      return failure(response, method, 400);
    const key = `${generation}\0${interactiveDiagnosticViewKey(diagnostic)}`;
    if (!input.reported.has(key)) {
      input.reported.add(key);
      input.onDiagnostic(interactiveDiagnosticLine(generation, diagnostic));
    }
    response.writeHead(204);
    response.end();
  } catch (error) {
    return failure(
      response,
      method,
      error instanceof InteractiveDiagnosticRequestError &&
        error.code === InteractiveDiagnosticInputError.TooLarge
        ? 413
        : 400,
    );
  }
}

function failure(
  response: ServerResponse,
  method: string,
  status: number,
): void {
  sendInteractive(
    response,
    status,
    "text/plain; charset=utf-8",
    status === 404 ? "Not found." : "Invalid Live diagnostic.",
    method,
  );
}
