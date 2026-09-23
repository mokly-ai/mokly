/** Validated public viewer composition over the shared React shell. */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { EmbeddedViewerShell } from "../shell/embedded_viewer.js";
import { ShellIdentifierProvider } from "../shell/identifier_context.js";
import { ShellStoreProvider } from "../shell/store.js";

import {
  viewerComparisonEnvironment,
  viewerShellEnvironment,
} from "./environment.js";
import { viewerFailures } from "./failures.js";
import { ViewerHostBridge } from "./host_bridge.js";
import { viewerCatalogue, viewerContext, viewerView } from "./projection.js";
import { defaultSelection, normalizeSelection } from "./selection.js";
import type { LoadedCatalogue } from "./source.js";
import { themeAttributes } from "./theme.js";
import type { MoklyViewerProps, ViewerSelection } from "./types.js";

type ReadyProps = MoklyViewerProps & {
  loaded: LoadedCatalogue;
  adapter: NonNullable<MoklyViewerProps["frameAdapter"]>;
  bridgeOwner: object;
  identifierPrefix: string;
  replaced: () => boolean;
};

const subscribeBrowser = () => () => undefined;
const browserSnapshot = () => true;
const serverSnapshot = () => false;

/** Validate host props before React constructs an interactive runtime. */
export function ReadyViewer(props: ReadyProps) {
  const [defaults] = useState(props.defaultSelection);
  const normalized = useMemo(() => {
    try {
      return normalizeSelection(
        props.loaded.catalogue,
        props.selection ?? { ...defaultSelection, ...defaults },
      );
    } catch {
      return undefined;
    }
  }, [props.loaded.catalogue, props.selection, defaults]);
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
      <div
        className="mokly-viewer mbk-empty"
        role="alert"
        {...themeAttributes(props.theme)}
      >
        The requested view is unavailable.
      </div>
    );
  return <MountedViewer {...props} normalized={normalized} />;
}

function MountedViewer(
  props: ReadyProps & {
    normalized: ViewerSelection;
  },
) {
  const root = useRef<HTMLDivElement>(null);
  const navigationEnd = useRef<(() => void) | undefined>(undefined);
  const callbacks = useRef<MoklyViewerProps>(props);
  callbacks.current = props;
  const [report] = useState(() =>
    viewerFailures(
      () => callbacks.current,
      () => root.current !== null,
    ),
  );
  const [initial] = useState(props.normalized);
  const [catalogue] = useState(() => viewerCatalogue(props.loaded.catalogue));
  const interactive = useSyncExternalStore(
    subscribeBrowser,
    browserSnapshot,
    serverSnapshot,
  );
  const environment = useMemo(
    () =>
      viewerShellEnvironment(
        props.loaded,
        props.normalized,
        props.selection !== undefined,
        () => callbacks.current,
        () => navigationEnd.current?.(),
      ),
    [props.loaded, props.normalized, props.selection !== undefined],
  );
  const comparisonEnvironment = useMemo(
    () =>
      viewerComparisonEnvironment(props.loaded, (error) => {
        report(error, "comparison");
      }),
    [props.loaded, report],
  );
  return (
    <ShellIdentifierProvider prefix={props.identifierPrefix}>
      <ShellStoreProvider
        catalogue={catalogue}
        comparisonEnvironment={comparisonEnvironment}
        context={viewerContext(props.loaded.catalogue, initial)}
        embeddedHost={environment}
        frameAdapter={props.adapter}
        frameBaseUrl={props.loaded.url}
        interactive={interactive}
        view={viewerView(catalogue, initial)}
      >
        <EmbeddedViewerShell
          inspection={
            interactive ? (
              <ViewerHostBridge
                callbacks={callbacks}
                failureOwner={props.bridgeOwner}
                handleRef={props.ref}
                loaded={props.loaded}
                navigationEnd={navigationEnd}
                replaced={props.replaced}
                root={root}
              />
            ) : undefined
          }
          markers={props.markers ?? []}
          onError={props.onError}
          onMarkerChange={props.onMarkerChange}
          rootRef={root}
          {...(props.theme ? { theme: props.theme } : {})}
          {...(props.slots ? { slots: props.slots } : {})}
        />
      </ShellStoreProvider>
    </ShellIdentifierProvider>
  );
}
