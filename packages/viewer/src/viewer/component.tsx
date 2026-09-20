import { useCallback, useEffect, useRef, useState } from "react";

import { sameOriginAdapter } from "../client/same_origin_adapter.js";

import {
  awaitHostBridgeFailureBarrier,
  consumeHostBridgeFailure,
} from "./host_bridge_failure.js";
import { viewerIdentifierPrefix } from "./identifiers.js";
import { ReadyViewer } from "./ready.js";
import { useCatalogue } from "./source_hook.js";
import type { MoklyViewerProps } from "./types.js";

/** Mount a validated catalogue with host-owned slots and isolated runtime state. */
export function MoklyViewer(props: MoklyViewerProps) {
  const identifierPrefix = viewerIdentifierPrefix(props.viewerId);
  const source = useCatalogue(props.catalogue, props.baseUrl);
  const [adapter] = useState(sameOriginAdapter);
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
    id: 0,
  });
  if (
    generation.current.source !== source.key ||
    generation.current.adapter !== selectedAdapter
  )
    generation.current = {
      source: source.key,
      adapter: selectedAdapter,
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
    { key: typeof source.key; invalid: boolean } | undefined
  >(undefined);
  useEffect(() => {
    if (!source.error && !invalidMode) {
      reported.current = undefined;
      return;
    }
    if (
      reported.current?.key === source.key &&
      reported.current.invalid === invalidMode
    )
      return;
    reported.current = { key: source.key, invalid: invalidMode };
    if (source.error || invalidMode)
      callbacks.current.onError?.({
        code: invalidMode ? "selection" : "catalogue",
        message: invalidMode
          ? "Remount the viewer to change how selection is managed."
          : "The catalogue could not be loaded. Try again.",
      });
  }, [source.error, source.key, invalidMode]);
  if (bridgeFailure?.drained) throw bridgeFailure.error;
  if (bridgeFailure) return null;
  if (source.error || invalidMode)
    return (
      <div className="mokly-viewer mbk-empty" role="alert">
        <h2>The catalogue could not be loaded</h2>
        <button type="button" onClick={source.retry}>
          Try again
        </button>
      </div>
    );
  if (!source.loaded)
    return (
      <div className="mokly-viewer mbk-empty" role="status">
        Loading catalogue…
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
      replaced={replaced}
    />
  );
}
