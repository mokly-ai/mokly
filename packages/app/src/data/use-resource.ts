import { useCallback, useEffect, useRef, useState } from "react";

import { asApiError, unexpectedError } from "../api/errors";
import type { ApiError } from "../api/errors";

import { createRequestSequence } from "./request-sequence";
import {
  resourceInvalidationVersion,
  useResourceInvalidationVersions,
} from "./resource-invalidation";
import { resourceForKey } from "./resource-key";

/** What a screen knows about one loaded thing. */
export type Resource<T> =
  | { status: "loading" }
  | {
      status: "ready";
      value: T;
      /** A newer read of the same thing runs, and the value waits for it. */
      refreshing?: boolean;
    }
  | { status: "error"; error: ApiError };

/** The request key that owns a held resource state. */
export interface KeyedResource<T> {
  key: string;
  state: Resource<T>;
}

/** Explicit reuse for immutable reads temporarily disabled by another read. */
export interface ResourceOptions {
  /** Default true. False reuses the held settled state only on re-enable. */
  reloadOnEnable?: boolean;
}

/** Static keys or keys derived from the loaded value. */
export type ResourceScopes<T> =
  readonly string[] | ((value: T) => readonly string[]);

/**
 * The state a read starts from. A value already read for the same key stays
 * while the read refreshes it, so an invalidation or a reload never takes
 * away what the reader is working on. A new key, a failure and a first read
 * start from loading.
 */
export function startRead<T>(
  current: Resource<T>,
  sameKey: boolean,
): Resource<T> {
  return sameKey && current.status === "ready"
    ? { status: "ready", value: current.value, refreshing: true }
    : { status: "loading" };
}

/** Whether a newer read of a value that is on screen runs. */
export function isRefreshing<T>(resource: Resource<T> | undefined): boolean {
  return resource?.status === "ready" && resource.refreshing === true;
}

/**
 * Load one thing for a screen, keeping its loading, ready and typed error
 * states separate so every surface can render the state it is actually in.
 * A refresh of the same key keeps the ready value and marks it refreshing;
 * a refresh that fails is an error, as a failed first read is.
 */
export function useResource<T>(
  load: () => Promise<T>,
  key: string,
  enabled = true,
  scopes: ResourceScopes<T> = [],
  options: ResourceOptions = {},
): KeyedResource<T> & { reload: () => void; set: (value: T) => void } {
  const [held, setHeld] = useState<KeyedResource<T>>({
    key,
    state: { status: "loading" },
  });
  const [attempt, setAttempt] = useState(0);
  const [sequence] = useState(createRequestSequence);
  const completed = useRef<
    { key: string; attempt: number; invalidation: number } | undefined
  >(undefined);
  const reloadOnEnable = options.reloadOnEnable ?? true;
  const versions = useResourceInvalidationVersions();
  // The loader closes over whatever the screen is showing now, and is rebuilt
  // every render; the key is what says which thing is being loaded, so it is
  // the key that decides when to load again. The ref is written after the
  // commit rather than during the render, because a render may be thrown away.
  const latest = useRef(load);
  const latestScopes = useRef(scopes);
  const activeScopes = useRef<readonly string[]>(
    typeof scopes === "function" ? [] : scopes,
  );
  // The key the value on screen was read for, and the key being shown now:
  // only a read of the same key may keep that value.
  const readFor = useRef<string | undefined>(undefined);
  const latestKey = useRef(key);
  useEffect(() => {
    latest.current = load;
    latestScopes.current = scopes;
    latestKey.current = key;
  });
  const invalidation = resourceInvalidationVersion(
    versions,
    activeScopes.current,
  );

  useEffect(() => {
    if (!enabled) return;
    const last = completed.current;
    if (
      !reloadOnEnable &&
      last?.key === key &&
      last.attempt === attempt &&
      last.invalidation === invalidation
    )
      return;
    const isLatest = sequence.next();
    completed.current = undefined;
    const sameKey = readFor.current === key;
    setHeld((current) => ({
      key,
      state: startRead(resourceForKey(key, current), sameKey),
    }));
    latest
      .current()
      .then((value) => {
        if (!isLatest()) return;
        const configured = latestScopes.current;
        activeScopes.current =
          typeof configured === "function" ? configured(value) : configured;
        readFor.current = key;
        completed.current = { key, attempt, invalidation };
        setHeld({ key, state: { status: "ready", value } });
      })
      .catch((caught: unknown) => {
        if (!isLatest()) return;
        completed.current = { key, attempt, invalidation };
        setHeld({
          key,
          state: {
            status: "error",
            error: asApiError(caught) ?? unexpectedError(),
          },
        });
      });
    return () => sequence.invalidate();
  }, [attempt, key, enabled, invalidation, reloadOnEnable, sequence]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  const set = useCallback(
    (value: T) => {
      sequence.invalidate();
      const configured = latestScopes.current;
      activeScopes.current =
        typeof configured === "function" ? configured(value) : configured;
      // Another key's manual value replaces the held settled read.
      if (completed.current?.key !== latestKey.current) {
        completed.current = undefined;
      }
      readFor.current = latestKey.current;
      setHeld({ key: latestKey.current, state: { status: "ready", value } });
    },
    [sequence],
  );
  return { key: held.key, state: resourceForKey(key, held), reload, set };
}
