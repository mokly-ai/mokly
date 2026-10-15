import { useCallback, useEffect, useId, useRef, useState } from "react";

import { VIEWER_DIRECTORY } from "../catalogue/delivery_paths.js";
import {
  MoklyVersionError,
  VERSION_ERROR_MESSAGE,
} from "../catalogue/version_error.js";
import { sameOriginAdapter } from "../client/same_origin_adapter.js";
import { memoryScrollTogether } from "../shell/comparison_scroll_preference.js";

import {
  awaitHostBridgeFailureBarrier,
  consumeHostBridgeFailure,
} from "./host_bridge_failure.js";
import { useIndexSource } from "./index_source.js";
import { ReadyViewer } from "./ready.js";
import { themeAttributes } from "./theme.js";
import type { MoklyViewerProps } from "./types.js";

/** Mount a validated catalogue with host-owned slots and isolated runtime state. */
export function MoklyViewer(props: MoklyViewerProps) {
  const identifierPrefix = `mokly-${useId().replace(/[^A-Za-z0-9_-]/g, "")}-`;
  const source = useIndexSource(props.index, props.baseUrl);
  const [detailVersion, setDetailVersion] = useState<{
    key: unknown;
    error: MoklyVersionError;
  }>();
  const versionError =
    source.error?.cause instanceof MoklyVersionError
      ? source.error.cause
      : detailVersion?.key === source.key
        ? detailVersion.error
        : undefined;
  const failed = source.error !== undefined || versionError !== undefined;
  const [adapter] = useState(sameOriginAdapter);
  const [scrollTogether] = useState(memoryScrollTogether);
  const selectedAdapter = props.frameAdapter ?? adapter;
  const bridgeOwner = useRef({});
  const [bridgeFailure, setBridgeFailure] = useState<
    { drained: boolean; error: unknown } | undefined
  >();
  useEffect(() => {
    let active = true;
    const owner = bridgeOwner.current;
    const stop = consumeHostBridgeFailure(owner, (error) => {
      void awaitHostBridgeFailureBarrier(owner).then(() => {
        if (active)
          setBridgeFailure((current) => current ?? { drained: false, error });
      });
    });
    return () => {
      active = false;
      stop();
    };
  }, []);
  useEffect(() => {
    if (bridgeFailure && !bridgeFailure.drained)
      setBridgeFailure({ ...bridgeFailure, drained: true });
  }, [bridgeFailure]);
  const generation = useRef({
    source: source.key,
    adapter: selectedAdapter,
    detail: props.detail,
    id: 0,
  });
  if (
    generation.current.source !== source.key ||
    generation.current.adapter !== selectedAdapter ||
    generation.current.detail !== props.detail
  )
    generation.current = {
      source: source.key,
      adapter: selectedAdapter,
      detail: props.detail,
      id: generation.current.id + 1,
    };
  const mountedGeneration = generation.current;
  const replaced = useCallback(
    () => generation.current !== mountedGeneration,
    [mountedGeneration],
  );
  const controlled = useRef(props.selection !== undefined);
  const invalidMode =
    controlled.current !== (props.selection !== undefined) ||
    (props.selection !== undefined &&
      (!props.onSelectionChange || props.defaultSelection !== undefined));
  const callbacks = useRef(props);
  callbacks.current = props;
  const reported = useRef<
    { key: unknown; invalid: boolean; version: unknown } | undefined
  >(undefined);
  useEffect(() => {
    if (!failed && !invalidMode) {
      reported.current = undefined;
      return;
    }
    const current = reported.current;
    if (
      current?.key === source.key &&
      current.invalid === invalidMode &&
      current.version === versionError
    )
      return;
    reported.current = {
      key: source.key,
      invalid: invalidMode,
      version: versionError,
    };
    callbacks.current.onError?.({
      code: invalidMode ? "selection" : versionError ? "version" : "catalogue",
      message: invalidMode
        ? "Remount the viewer to change how selection is managed."
        : versionError
          ? VERSION_ERROR_MESSAGE
          : "The catalogue could not be loaded. Try again.",
      ...(!invalidMode && versionError
        ? { details: versionError.message }
        : {}),
    });
  }, [failed, source.key, invalidMode, versionError]);
  if (bridgeFailure?.drained) throw bridgeFailure.error;
  if (bridgeFailure) return null;
  if (failed || invalidMode)
    return (
      <div
        className={`${VIEWER_DIRECTORY} mbk-empty`}
        role="alert"
        {...themeAttributes(props.theme)}
      >
        {!invalidMode && versionError ? (
          <h2>{VERSION_ERROR_MESSAGE}</h2>
        ) : (
          <>
            <h2>The catalogue could not be loaded</h2>
            <button
              className="mbk-empty-link"
              onClick={source.retry}
              type="button"
            >
              Try again
            </button>
          </>
        )}
      </div>
    );
  if (!source.loaded)
    return (
      <div
        aria-busy="true"
        className={`${VIEWER_DIRECTORY} mbk-empty`}
        {...themeAttributes(props.theme)}
      >
        <p role="status">Loading catalogue…</p>
      </div>
    );
  return (
    <ReadyViewer
      key={generation.current.id}
      {...props}
      loaded={source.loaded}
      adapter={selectedAdapter}
      bridgeOwner={bridgeOwner.current}
      identifierPrefix={identifierPrefix}
      onVersionError={(error) => setDetailVersion({ key: source.key, error })}
      replaced={replaced}
      scrollTogether={scrollTogether}
    />
  );
}
