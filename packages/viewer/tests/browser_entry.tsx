import { StrictMode, createRef } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import {
  MoklyViewer,
  postMessageAdapter,
  sameOriginAdapter,
} from "@mokly/viewer";
import type {
  CatalogueReadModel,
  EntryDetailV2,
  MoklyViewerHandle,
  MoklyViewerProps,
  ViewerMarker,
  ViewerSelection,
  ViewerTheme,
} from "@mokly/viewer";

import { browserDetails } from "./browser_details.js";
import { installFrameHookHarness } from "./frame_hook_harness.js";

interface HostOptions {
  controlled?: boolean;
  accept?: boolean;
  strict?: boolean;
  cross?: boolean;
  slots?: boolean;
  source?: MoklyViewerProps["index"];
  defaultSelection?: Partial<ViewerSelection>;
  responsive?: boolean;
  topBarSlots?: boolean;
}
interface Host {
  root: Root;
  props: MoklyViewerProps;
  details: Record<string, EntryDetailV2>;
  ref: { current: MoklyViewerHandle | null };
  events: { name: string; value: unknown }[];
  render(): void;
  setMarkers(markers: readonly Omit<ViewerMarker, "content">[]): void;
  setSelection(value: ViewerSelection): void;
  setTheme(theme: ViewerTheme): void;
  options: HostOptions;
}
const hosts = new Map<string, Host>();
const data = (
  window as unknown as {
    fixture: {
      index: CatalogueReadModel;
      details: {
        current: Record<string, EntryDetailV2>;
        removed: Record<string, EntryDetailV2>;
      };
      baseUrl: string;
    };
  }
).fixture;
const start = (id: string, options: HostOptions = {}) => {
  const element = document.createElement("section");
  element.id = id;
  element.style.cssText = options.responsive
    ? "height:900px;width:100%;position:relative;font-size:18px"
    : "height:900px;width:1200px;position:relative";
  if (options.responsive) document.body.style.margin = "0";
  document.body.append(element);
  const ref = createRef<MoklyViewerHandle>();
  const events: Host["events"] = [];
  const log = (name: string, value: unknown = null) => {
    events.push({ name, value });
  };
  const state: ViewerSelection = {
    screenPath: "home",
    view: "all",
    viewport: "mobile",
    colorScheme: "light",
    search: "",
    tags: [],
    ...options.defaultSelection,
  };
  const host: Host = {
    root: createRoot(element),
    options,
    ref,
    events,
    props: {} as MoklyViewerProps,
    details: structuredClone(data.details.current),
    render() {
      if (
        typeof host.props.index === "object" &&
        !(host.props.index instanceof URL) &&
        host.props.index.schemaVersion === 8
      )
        host.details = browserDetails(host.props.index, host.details);
      const node = <MoklyViewer {...host.props} ref={ref} />;
      host.root.render(options.strict ? <StrictMode>{node}</StrictMode> : node);
    },
    setMarkers(markers) {
      host.props = {
        ...host.props,
        markers: markers.map((marker) => ({
          ...marker,
          content: (
            <button
              data-marker-content={marker.id}
              onClick={() => log("marker-click", marker.id)}
              style={{ pointerEvents: "auto" }}
            >
              {marker.id}
            </button>
          ),
        })),
      } as MoklyViewerProps;
      host.render();
    },
    setTheme(theme) {
      host.props = { ...host.props, theme } as MoklyViewerProps;
      host.render();
    },
    setSelection(value) {
      host.props = {
        ...host.props,
        selection: value,
        onSelectionChange: host.props.onSelectionChange!,
      } as MoklyViewerProps;
      host.render();
    },
  };
  const sourceNeedsBaseUrl =
    options.source === undefined ||
    (typeof options.source === "object" && !(options.source instanceof URL));
  host.props = {
    index: options.source ?? data.index,
    detail: (path: string, snapshotId?: string) =>
      snapshotId === undefined
        ? host.details[path]!
        : data.details.removed[snapshotId]!,
    ...(sourceNeedsBaseUrl
      ? { baseUrl: options.cross ? data.baseUrl : location.origin }
      : {}),
    frameAdapter: options.cross
      ? postMessageAdapter({ frameOrigin: data.baseUrl })
      : sameOriginAdapter(),
    ...(options.controlled
      ? { selection: state }
      : { defaultSelection: state }),
    onSelectionChange: (selection: ViewerSelection) => {
      log("selection", selection);
      if (options.accept) host.setSelection(selection);
    },
    onScreenNavigate: (event) => log("navigate", event),
    onInstanceHover: (event) => log("hover", event),
    onInstanceClick: (event) => log("click", event),
    onPickStart: () => log("pick-start"),
    onPickEnd: (event) => log("pick-end", event),
    onMarkerChange: (states) => log("markers", states),
    onError: (error) => log("error", error),
  } as MoklyViewerProps;
  if (options.slots || options.topBarSlots)
    host.props.slots = {
      topBarStart: (
        <button
          onClick={() => log("slot")}
          style={options.responsive ? { width: 106 } : undefined}
        >
          Host start
        </button>
      ),
      topBarEnd: options.responsive ? (
        <button style={{ width: 76 }}>Host end</button>
      ) : (
        <span>Host end</span>
      ),
      ...(options.slots
        ? {
            railStart: <span>Rail start</span>,
            railEnd: <span>Rail end</span>,
            sidePanel: { content: <span>Side panel</span>, width: 240 },
            stageOverlay: {
              content: <span>Annotation</span>,
              pointerEvents: "none" as const,
            },
            emptyState: <p>Host home</p>,
          }
        : {}),
    };
  hosts.set(id, host);
  host.render();
  return host;
};
(window as unknown as { viewerHarness: unknown }).viewerHarness = {
  start,
  get: (id: string) => hosts.get(id),
  remove: (id: string) => {
    const host = hosts.get(id);
    host?.root.unmount();
    document.getElementById(id)?.remove();
  },
};
installFrameHookHarness();
