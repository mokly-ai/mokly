import type { Request } from "../generated/sidecar/Request.js";

import { protocol } from "./errors.js";
import { parameterShapes } from "./parameter-shapes.js";
import { requestId } from "./request-id.js";

const shapes: Record<string, string[]> = {
  hello: [],
  shutdown: [],
  bundle: [
    "entryFiles",
    "storiesFiles",
    "renderer",
    "moduleResolution",
    "sourceRoot",
    "configurationDirectory",
    "repositoryRoots",
  ],
  describe: ["generation"],
  dispose: ["generation"],
  disposeContext: ["context"],
  bindings: ["generation", "entries"],
  cssModules: ["generation", "classMaps"],
  renderScreen: [
    "generation",
    "handle",
    "entry",
    "props",
    "viewport",
    "colorScheme",
  ],
  renderComponent: [
    "generation",
    "handle",
    "entry",
    "props",
    "viewport",
    "colorScheme",
    "slots",
    "ignoreScope",
  ],
  renderStory: ["generation", "storyId", "props", "viewport", "colorScheme"],
  renderPage: ["generation", "handle"],
  processCss: [
    "repositoryRoots",
    "context",
    "sourceRoot",
    "moduleResolution",
    "postcss",
    "sourcePath",
    "text",
  ],
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Validate the wire envelope before accessing any consumer path or value. */
export function request(value: unknown): Request {
  if (
    !record(value) ||
    Object.keys(value).some(
      (key) => !["id", "method", "params"].includes(key),
    ) ||
    requestId(value) === undefined ||
    typeof value.method !== "string" ||
    !record(value.params)
  )
    protocol("request must have a u64 id, method and params object");
  const expected = shapes[value.method];
  if (!expected) protocol(`unknown method ${value.method}`);
  const params = value.params;
  if (
    Object.keys(params).some((key) => !expected.includes(key)) ||
    expected.some((key) => key !== "renderer" && !Object.hasOwn(params, key))
  )
    protocol(`invalid params for ${value.method}`);
  if (value.method === "bundle" && !Object.hasOwn(params, "renderer"))
    params.renderer = null;
  parameterShapes(params);
  for (const key of [
    "generation",
    "context",
    "configurationDirectory",
    "handle",
    "storyId",
    "sourceRoot",
    "postcss",
    "sourcePath",
    "text",
  ])
    if (Object.hasOwn(params, key) && typeof params[key] !== "string")
      protocol(`${key} must be a string`);
  for (const key of ["props", "slots", "classMaps", "moduleResolution"])
    if (Object.hasOwn(params, key) && !record(params[key]))
      protocol(`${key} must be an object`);
  if (
    Object.hasOwn(params, "viewport") &&
    !["mobile", "desktop"].includes(String(params.viewport))
  )
    protocol("invalid viewport");
  if (
    Object.hasOwn(params, "colorScheme") &&
    !["light", "dark"].includes(String(params.colorScheme))
  )
    protocol("invalid color scheme");
  if (
    Object.hasOwn(params, "ignoreScope") &&
    !["enabled", "disabled"].includes(String(params.ignoreScope))
  )
    protocol("invalid ignore scope");
  for (const key of ["entryFiles", "storiesFiles", "repositoryRoots"])
    if (
      Object.hasOwn(params, key) &&
      (!Array.isArray(params[key]) ||
        !params[key].every((file) => typeof file === "string"))
    )
      protocol(`${key} must be a string array`);
  return value as Request;
}
