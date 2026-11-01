/** Validated public viewer composition over the shared React shell. */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { RootState } from "@mokly/ui/shell-layout";

import { shellCatalogueModel } from "../catalogue/shell_model.js";
import type { LoadedIndex } from "../catalogue/sources.js";
import { DeploymentChangedError } from "../catalogue/sources.js";
import type { MoklyVersionError } from "../catalogue/version_error.js";
import { EntryUnavailableError, viewerFailures } from "../host/failures.js";
import type { MoklyViewerProps, ViewerSelection } from "../host/types.js";
import type { ScrollTogetherPreference } from "../shell/comparison_scroll_preference.js";
import { EmbeddedViewerShell } from "../shell/embedded_viewer.js";
import { ShellIdentifierProvider } from "../shell/identifier_context.js";
import { defaultSelection, normalizeSelection } from "../shell/selection.js";
import { ShellStoreProvider } from "../shell/store.js";
import { hostRoute } from "../shell/store_host_routes.js";
import { viewRoute } from "../shell/store_initial.js";
import { normalizeTheme } from "../shell/theme.js";

import {
  viewerComparisonEnvironment,
  viewerShellEnvironment,
} from "./environment.js";
import { ViewerHostBridge } from "./host_bridge.js";
import { embeddedDataSource } from "./index_source.js";

type ReadyProps = MoklyViewerProps & {
  loaded: LoadedIndex;
  onVersionError(error: MoklyVersionError): void;
  adapter: NonNullable<MoklyViewerProps["frameAdapter"]>;
  bridgeOwner: object;
  identifierPrefix: string;
  replaced: () => boolean;
  /** The mounted viewer's Scroll together choice, kept across sources. */
  scrollTogether: ScrollTogetherPreference;
};

const subscribeBrowser = () => () => undefined;
const browserSnapshot = () => true;
const serverSnapshot = () => false;

/** Validate host props before React constructs an interactive runtime. */
export function ReadyViewer(props: ReadyProps) {
  const [defaults] = useState(props.defaultSelection);
  const model = useMemo(
    () => shellCatalogueModel(props.loaded.index, new Map()),
    [props.loaded.index],
  );
  const normalized = useMemo(() => {
    try {
      return normalizeSelection(
        model,
        props.selection ?? { ...defaultSelection, ...defaults },
      );
    } catch {
      return undefined;
    }
  }, [model, props.selection, defaults]);
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
      <RootState
        root={{ kind: "embedded", theme: normalizeTheme(props.theme) }}
        state="unavailable"
      />
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
  const [replacedDeployment] = useState(() => new DeploymentChangedError());
  const [initial] = useState(props.normalized);
  const [source] = useState(() => {
    // One failure object, so another deployment emits `onError` once.
    return embeddedDataSource(props.index, props.loaded, props.detail, {
      deploymentChanged: () => report(replacedDeployment, "catalogue"),
      detailFailed: () => report(new EntryUnavailableError(), "catalogue"),
    });
  });
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
      viewerComparisonEnvironment(
        props.loaded,
        (error) => {
          report(error, "comparison");
        },
        props.scrollTogether,
        typeof props.index === "string" || props.index instanceof URL
          ? () => report(replacedDeployment, "catalogue")
          : undefined,
        typeof props.index === "string" || props.index instanceof URL,
      ),
    [props.loaded, props.scrollTogether, report],
  );
  return (
    <ShellIdentifierProvider prefix={props.identifierPrefix}>
      <ShellStoreProvider
        comparisonEnvironment={comparisonEnvironment}
        context={{
          embedded: true,
          ...(props.theme ? { theme: props.theme } : {}),
        }}
        embeddedHost={environment}
        frameAdapter={props.adapter}
        frameBaseUrl={props.loaded.root}
        index={props.loaded.index}
        interactive={interactive}
        onVersionError={props.onVersionError}
        route={(catalogue) =>
          viewRoute(
            catalogue,
            hostRoute(catalogue, initial).view,
            initial.snapshotId,
          )
        }
        source={source}
      >
        <EmbeddedViewerShell
          inspection={
            interactive ? (
              <ViewerHostBridge
                callbacks={callbacks}
                failureOwner={props.bridgeOwner}
                handleRef={props.ref}
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
