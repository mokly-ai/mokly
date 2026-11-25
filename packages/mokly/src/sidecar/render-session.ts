import { randomBytes } from "node:crypto";

import { validateDestination } from "../authoring/links.js";
import { definitionData } from "../authoring/runtime.js";
import type { RenderSession } from "../authoring/runtime.js";
import type { RenderContext } from "../authoring/types.js";

import type { Generation } from "./bundle.js";
import { SidecarError, detail, handleLocation } from "./errors.js";

export async function withRenderSession<T>(
  generation: Generation,
  handle: string,
  {
    viewport,
    colorScheme,
  }: { viewport: string; colorScheme: RenderContext["colorScheme"] },
  render: (session: RenderSession) => T | Promise<T>,
): Promise<T> {
  const location = handleLocation(handle);
  try {
    const session = renderSession(
      generation,
      { viewport: viewport as RenderContext["viewport"], colorScheme },
      location,
    );
    return await generation.runtime.withSession(session, () => render(session));
  } catch (error) {
    if (error instanceof SidecarError) throw error;
    throw new SidecarError(
      "render-failed",
      `${location} (${viewport}, ${colorScheme}): ${detail(error)}`,
    );
  }
}

export function renderSession(
  generation: Generation,
  context: RenderContext,
  location = "unknown module",
): RenderSession {
  let region = 0;
  const session: RenderSession = {
    context,
    sourceRoot: generation.params.sourceRoot,
    dependencyRoots: generation.dependencyRoots,
    location,
    inputOrders: new Map(),
    instances: [],
    slots: [],
    registrations: generation.registrations,
    markers: new Map(),
    placeholders: new Set(),
    nextRegion: () => `r-${++region}`,
    boundary(comment) {
      const token = randomBytes(24).toString("hex");
      session.markers.set(token, comment);
      return generation.runtime.react.createElement("template", {
        "data-mokly-boundary": token,
      });
    },
    link(target, fragment) {
      validateDestination(target, fragment);
      const registered =
        typeof target === "object" && target !== null
          ? generation.registrations.get(target)
          : undefined;
      if (!registered)
        throw new SidecarError(
          "unknown-link-definition",
          `${location}: referenced definition ${definitionData(target)?.input.title ?? "unknown"} from ${definitionData(target)?.source ?? "unknown module"} is not exported by an entry module`,
        );
      if (!registered.path)
        throw new Error(
          `definition ${registered.handle} requires its resolved catalogue path`,
        );
      validateDestination(registered.path);
      return `mock:${registered.path}${fragment ? `#${fragment}` : ""}`;
    },
    logicalLink(value) {
      const deferred = generation.runtime.links.get(value);
      return deferred
        ? session.link(deferred.target, deferred.fragment, deferred.source)
        : value;
    },
  };
  return session;
}
