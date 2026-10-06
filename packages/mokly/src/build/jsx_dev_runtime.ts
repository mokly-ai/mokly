import type { jsxDEV } from "react/jsx-dev-runtime";
import { jsx, jsxs } from "react/jsx-runtime";

import { isComponentWrapper } from "../components/wrapper_identity.js";

import { normalizeComponentSource } from "./component_source.js";

/** Build a shim in the consumer graph, always using its production JSX entrypoints. */
export function createJsxDEV(
  workingDir: string,
  repoRoot: string,
): typeof jsxDEV {
  return (type, props, key, isStaticChildren, source) => {
    const location = isComponentWrapper(type)
      ? normalizeComponentSource(source, workingDir, repoRoot)
      : undefined;
    const input = location
      ? Object.defineProperties(
          {},
          {
            ...Object.getOwnPropertyDescriptors(props),
            __moklySource: { value: location, enumerable: true },
          },
        )
      : props;
    return (isStaticChildren ? jsxs : jsx)(type, input, key);
  };
}
