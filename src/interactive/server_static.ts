/** Live document composition and confined public-file delivery. */

import fs from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";

import { adaptBrowseDocument } from "../browse/document_adapter.js";
import { generatedBytes } from "../build/generated_file.js";
import {
  isGeneratedRoute,
  isPublicGeneratedRoute,
} from "../build/styles/routes.js";
import { publicFileLocation } from "../config/public_files.js";
import { contentType, safeDecodePath } from "../server/respond.js";

import type { InteractiveBundleService } from "./bundle_state.js";
import {
  buildInteractiveBootstrap,
  composeInteractiveDocument,
} from "./document.js";
import { InteractiveViewEligibilityError } from "./errors.js";
import {
  type InteractiveGeneration,
  validateInteractiveViewQuery,
} from "./generation.js";
import { sendInteractive, sendInteractiveState } from "./responses.js";

interface InteractiveStaticRequest {
  appOrigin?: string;
  appPort: number;
  bundles: InteractiveBundleService;
  context: InteractiveGeneration;
  frameAncestors: string;
  frameOrigin: string;
  method: string;
  response: ServerResponse;
  url: URL;
}

/** Serve a current Live view or an ordinary public resource. */
export async function serveInteractiveStatic(
  input: InteractiveStaticRequest,
): Promise<void> {
  const { bundles, context, method, response, url } = input;
  if (method !== "GET" && method !== "HEAD")
    return sendInteractive(
      response,
      405,
      "text/plain; charset=utf-8",
      "Method not allowed.",
      method,
    );
  const route = safeDecodePath(url.pathname.slice(8));
  if (!route)
    return sendInteractive(
      response,
      400,
      "text/plain; charset=utf-8",
      "Invalid static path.",
      method,
    );
  const target = context.views.get(route);
  if (!target) {
    if (isGeneratedRoute(route)) {
      const content = isPublicGeneratedRoute(route)
        ? context.documents.styles.get(route)
        : undefined;
      if (content === undefined) return notFound(response, method);
      return sendInteractive(
        response,
        200,
        contentType(route),
        generatedBytes(content),
        method,
      );
    }
    if (context.generatedRoutes.has(route)) return notFound(response, method);
    return publicFile(response, method, route, url.searchParams, context);
  }
  const query = validateInteractiveViewQuery(url.searchParams, target, {
    ...(input.appOrigin ? { appOrigin: input.appOrigin } : {}),
    appPort: input.appPort,
    frameOrigin: input.frameOrigin,
  });
  if (query === "invalid")
    return sendInteractive(
      response,
      400,
      "text/plain; charset=utf-8",
      "Invalid Live view query.",
      method,
    );
  if (query === "not-found") return notFound(response, method);
  let bootstrap;
  try {
    bootstrap = buildInteractiveBootstrap({
      catalogueSchemes: context.config.colorSchemes,
      colorScheme: target.colorScheme,
      entries: context.entries,
      entryPath: target.entryPath,
      generation: context.generation,
      sourceRoute: route,
      ...(target.variantPath ? { variantPath: target.variantPath } : {}),
      viewport: target.viewport,
    });
  } catch (error) {
    if (error instanceof InteractiveViewEligibilityError)
      return notFound(response, method);
    throw error;
  }
  let state = bundles.state(context.generation);
  if (state === "idle") state = bundles.start(context.generation);
  if (state === "building")
    return sendInteractiveState(
      response,
      503,
      context.generation,
      "building",
      method,
    );
  if (state === "failed") {
    if (bundles.failure(context.generation) === "bundle")
      return sendInteractiveState(
        response,
        503,
        context.generation,
        "failed",
        method,
      );
    return sendInteractive(
      response,
      500,
      "text/plain; charset=utf-8",
      "Could not prepare this Live preview.",
      method,
    );
  }
  const document = await context.documents.read(route);
  const adapted = adaptBrowseDocument(document.html, route, context.catalogue);
  const live = composeInteractiveDocument(adapted, bootstrap);
  sendInteractive(response, 200, "text/html; charset=utf-8", live, method, {
    "content-security-policy": input.frameAncestors,
  });
}

function publicFile(
  response: ServerResponse,
  method: string,
  route: string,
  search: URLSearchParams,
  context: InteractiveGeneration,
): void {
  if ([...search].length > 0)
    return sendInteractive(
      response,
      400,
      "text/plain; charset=utf-8",
      "Invalid static query.",
      method,
    );
  const candidate = path.resolve(context.config.mockupsDir, route);
  const location = publicFileLocation(candidate, context.config);
  if (!location) return notFound(response, method);
  let content: Buffer;
  try {
    content = fs.readFileSync(location.physicalPath);
  } catch {
    return notFound(response, method);
  }
  sendInteractive(response, 200, contentType(candidate), content, method);
}

function notFound(response: ServerResponse, method: string): void {
  sendInteractive(
    response,
    404,
    "text/plain; charset=utf-8",
    "Not found.",
    method,
  );
}
