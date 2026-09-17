import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ViewerLayout } from "./layout.js";
import { viewerCatalogue, viewerContext, viewerView } from "./projection.js";
import { ViewerRuntime } from "./runtime.js";
import { defaultSelection, normalizeSelection } from "./selection.js";
import type { LoadedCatalogue } from "./source.js";
import type { MoklyViewerProps, ViewerSelection } from "./types.js";

type ReadyProps = MoklyViewerProps & {
  loaded: LoadedCatalogue;
  adapter: NonNullable<MoklyViewerProps["frameAdapter"]>;
  replaced: () => boolean;
};

/** Validate host props before React constructs an interactive runtime. */
export function ReadyViewer(props: ReadyProps) {
  const [defaults] = useState(props.defaultSelection);
  const normalized = useMemo(() => {
    try {
      return normalizeSelection(
        props.selection ?? { ...defaultSelection, ...defaults },
      );
    } catch {
      return undefined;
    }
  }, [props.selection, defaults]);
  const reported = useRef(false);
  const callbacks = useRef(props);
  callbacks.current = props;
  useEffect(() => {
    if (normalized) reported.current = false;
    else if (!reported.current) {
      reported.current = true;
      callbacks.current.onError?.({
        code: "selection",
        message: "The requested catalogue selection is unavailable.",
      });
    }
  }, [normalized]);
  if (!normalized)
    return (
      <div className="mokly-viewer mbk-empty" role="alert">
        The requested view is unavailable.
      </div>
    );
  return <MountedViewer {...props} normalized={normalized} />;
}
function MountedViewer(
  props: MoklyViewerProps & {
    normalized: ViewerSelection;
    loaded: LoadedCatalogue;
    adapter: NonNullable<MoklyViewerProps["frameAdapter"]>;
    replaced: () => boolean;
  },
) {
  const container = useRef<HTMLDivElement>(null);
  const runtime = useRef<ViewerRuntime | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [initial] = useState(props.normalized);
  const [catalogue] = useState(() => viewerCatalogue(props.loaded.catalogue));
  useLayoutEffect(() => {
    const instance = new ViewerRuntime(
      container.current!.querySelector<HTMLElement>("[data-mokly-shell]")!,
      props.loaded.catalogue,
      props.loaded.url,
      props.adapter,
      initial,
      props.selection !== undefined,
      () => callbacks.current,
    );
    runtime.current = instance;
    return () => {
      runtime.current = null;
      instance.dispose(props.replaced() ? "source-change" : undefined);
    };
  }, []);
  useLayoutEffect(() => {
    if (props.selection) runtime.current?.commit(props.normalized);
  }, [props.normalized]);
  useLayoutEffect(() => {
    runtime.current?.refreshLayout();
  });
  useImperativeHandle(
    props.ref,
    () => ({
      select: (selection) => runtime.current?.select(selection),
      highlightInstance: (instance) =>
        runtime.current?.highlightInstance(instance) ??
        Promise.reject(new Error("The viewer is not ready.")),
      scrollToInstance: (instance) =>
        runtime.current?.scrollToInstance(instance) ??
        Promise.reject(new Error("The viewer is not ready.")),
      startPick: () =>
        runtime.current?.startPick() ??
        Promise.reject(new Error("The viewer is not ready.")),
      cancelPick: () => runtime.current?.cancelPick(),
    }),
    [],
  );
  return (
    <div ref={container} style={{ display: "contents" }}>
      <ViewerLayout
        catalogue={catalogue}
        context={viewerContext(props.loaded.catalogue, initial)}
        view={viewerView(catalogue, initial)}
        selection={initial}
        baseUrl={props.loaded.url}
        {...(props.slots ? { slots: props.slots } : {})}
      />
    </div>
  );
}
