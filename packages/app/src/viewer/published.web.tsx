import { useCallback, useContext, useMemo, useRef, useState } from "react";

import { MoklyViewer, postMessageAdapter } from "@mokly/viewer";
import type { ViewerError, ViewerSlots as PackageSlots } from "@mokly/viewer";

import { viewerHostProps } from "../layout/drag-covers";

import { packageSlots } from "./bar";
import { catalogueArtifactOrigin } from "./catalogue-source.web";
import type { ViewerHostProps } from "./host";
import { fromPackageSelection, toPackageSelection } from "./package-selection";
import { PlaceholderViewer } from "./placeholder";
import { CatalogueSourceContext } from "./source-context";
import { AccessBlocked } from "./stage";

function comparisonOverlay(
  catalogueOrigin: string,
): PackageSlots["stageOverlay"] {
  return {
    content: (
      <div className="fo-viewer-overlay fo-stage-canvas">
        <AccessBlocked catalogueUrl={catalogueOrigin} />
      </div>
    ),
    pointerEvents: "auto",
  };
}

function comparisonKey(
  catalogueOrigin: string | undefined,
  selection: ViewerHostProps["selection"],
): string {
  return JSON.stringify([
    catalogueOrigin,
    selection.screen ?? null,
    selection.snapshotId ?? null,
    selection.view,
    selection.viewport,
    selection.scheme,
    selection.search,
    selection.tags,
  ]);
}

/**
 * The published package mounted behind the cloud's controlled host boundary.
 *
 * The host passes the package the index and the detail source that it read
 * itself, keyed to the publication origin and credential policy, and the
 * frame adapter keyed to the origin alone, so the package runtime remounts
 * only when one of them changes; a selection or theme change keeps it. Every
 * reported error goes to the document's source, which latches a `version`
 * error until a new source or a document reload, and the stage then draws the
 * version card in place of the package. A private `comparison` error adds the
 * stage overlay that offers the catalogue in its own tab.
 */
export function ViewerHost(props: ViewerHostProps) {
  const {
    catalogue,
    selection,
    onSelectionChange,
    theme,
    status,
    slots,
    holdReady = false,
  } = props;
  const fallback = useRef({ status, stageMessage: props.stageMessage });
  const sources = useContext(CatalogueSourceContext);
  if (status !== "ready") {
    fallback.current = { status, stageMessage: props.stageMessage };
  }
  const source = catalogue?.source;
  const selectedComparison = useMemo(
    () => comparisonKey(source?.origin, selection),
    [source, selection],
  );
  const [blockedComparison, setBlockedComparison] = useState<string>();
  const root = useMemo(
    () =>
      source === undefined ? undefined : catalogueArtifactOrigin(source.origin),
    [source],
  );
  const frameOrigin = root?.origin;
  const frameAdapter = useMemo(
    () =>
      frameOrigin === undefined
        ? undefined
        : postMessageAdapter({ frameOrigin }),
    [frameOrigin],
  );
  const packaged = useMemo(() => toPackageSelection(selection), [selection]);
  const change = useCallback(
    (next: Parameters<typeof fromPackageSelection>[0]) => {
      setBlockedComparison(undefined);
      onSelectionChange?.(fromPackageSelection(next));
    },
    [onSelectionChange],
  );
  const error = useCallback(
    (reported: ViewerError) => {
      if (source === undefined) return;
      sources?.report(source, reported);
      if (source.credentialed && reported.code === "comparison") {
        setBlockedComparison(selectedComparison);
      }
    },
    [source, sources, selectedComparison],
  );

  if (
    status !== "ready" ||
    catalogue === undefined ||
    root === undefined ||
    frameAdapter === undefined
  ) {
    return <PlaceholderViewer {...props} />;
  }
  if (holdReady) {
    return (
      <PlaceholderViewer
        {...props}
        status={fallback.current.status}
        stageMessage={fallback.current.stageMessage}
      />
    );
  }

  const composed = packageSlots(slots);
  const comparisonBlocked = blockedComparison === selectedComparison;
  const packageChrome: PackageSlots = comparisonBlocked
    ? {
        ...composed,
        stageOverlay: comparisonOverlay(catalogue.source.origin),
      }
    : { ...composed };
  // The wrapper's mark lets the Mac window's drag check find what the package
  // draws, with no package selector.
  return (
    <div className="fo-published-viewer" {...viewerHostProps}>
      <MoklyViewer
        index={catalogue.index}
        baseUrl={root}
        detail={catalogue.detail}
        frameAdapter={frameAdapter}
        theme={theme}
        selection={packaged}
        onSelectionChange={change}
        onError={error}
        slots={packageChrome}
      />
    </div>
  );
}
