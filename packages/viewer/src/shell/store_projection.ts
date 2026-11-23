import { useLayoutEffect, useMemo, useRef } from "react";

import { sameJsonValue } from "../catalogue/json_values.js";

import type { ShellContext } from "./context.js";

/** Keep equal shell context and entry lists from the last committed render. */
export function useStableShellContext(projected: ShellContext): ShellContext {
  const installed = useRef(projected);
  const context = useMemo(() => {
    const held = installed.current;
    if (sameJsonValue(held, projected)) return held;
    const { changedEntries, materialEntries } = held;
    return {
      ...projected,
      ...(changedEntries &&
      sameJsonValue(changedEntries, projected.changedEntries)
        ? { changedEntries }
        : {}),
      ...(materialEntries &&
      sameJsonValue(materialEntries, projected.materialEntries)
        ? { materialEntries }
        : {}),
    };
  }, [projected]);
  useLayoutEffect(() => {
    installed.current = context;
  }, [context]);
  return context;
}
