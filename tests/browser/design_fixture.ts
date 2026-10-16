import path from "node:path";

import { repositoryRoot } from "../helpers/fixture.js";

import { ownExampleServerUrl } from "./example_servers.js";

/** Map an authored design's document path to the worker's Serve origin. */
export function designFileUrl(file: string): URL {
  const root = path.join(repositoryRoot, "examples/basic/mokly-generated");
  const route = path.relative(root, file).split(path.sep).join("/");
  if (route.startsWith("../") || path.isAbsolute(route))
    throw new Error("Design document is outside the catalogue");
  const origin = ownExampleServerUrl();
  if (!origin) throw new Error("The browser example server is not ready");
  return new URL(`/static/mokly-generated/${route}`, origin);
}
