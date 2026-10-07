import { useEffect, useMemo, useState } from "react";

import {
  catalogueUrl,
  loadSource,
  readObjectSource,
  sourceIdentity,
} from "./source.js";
import type { LoadedCatalogue } from "./source.js";
import type { CatalogueSource } from "./types.js";

export function useCatalogue(source: CatalogueSource, baseUrl?: string | URL) {
  const [retry, setRetry] = useState(0);
  const identity = sourceIdentity(source);
  let base: string | undefined;
  try {
    base = baseUrl === undefined ? undefined : catalogueUrl(baseUrl).origin;
  } catch {
    base = String(baseUrl);
  }
  const initial = useMemo(() => {
    try {
      return { loaded: readObjectSource(source, baseUrl), error: undefined };
    } catch (cause) {
      return { loaded: undefined, error: { cause } };
    }
  }, [identity, base, retry]);
  const [result, setResult] = useState<{
    key: typeof initial;
    loaded?: LoadedCatalogue;
    error?: { cause: unknown };
  }>();
  useEffect(() => {
    if (initial.loaded || initial.error) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        return loadSource(source, baseUrl, controller.signal);
      })
      .then(
        (loaded) => {
          if (!controller.signal.aborted) setResult({ key: initial, loaded });
        },
        (cause: unknown) => {
          if (!controller.signal.aborted)
            setResult({ key: initial, error: { cause } });
        },
      );
    return () => controller.abort();
  }, [initial]);
  return {
    key: initial,
    loaded:
      initial.loaded ?? (result?.key === initial ? result.loaded : undefined),
    error:
      initial.error ?? (result?.key === initial ? result.error : undefined),
    retry: () => setRetry((value) => value + 1),
  };
}
