import { randomBytes } from "node:crypto";

import { validateDestination } from "../authoring/links.js";
import type { RenderSession } from "../authoring/runtime.js";
import type { RenderContext } from "../authoring/types.js";

import type { Generation } from "./bundle.js";
import { SidecarError } from "./errors.js";

export function renderSession(
  generation: Generation,
  context: RenderContext,
): RenderSession {
  let region = 0;
  const session: RenderSession = {
    context,
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
          "referenced definition is not exported by an entry module",
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
        ? session.link(deferred.target, deferred.fragment)
        : value;
    },
  };
  return session;
}
