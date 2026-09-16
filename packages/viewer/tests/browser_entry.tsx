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
  MoklyViewerHandle,
  MoklyViewerProps,
  ViewerSelection,
} from "@mokly/viewer";

interface HostOptions {
  controlled?: boolean;
  accept?: boolean;
  strict?: boolean;
  cross?: boolean;
  slots?: boolean;
  source?: MoklyViewerProps["catalogue"];
  defaultSelection?: Partial<ViewerSelection>;
}
interface Host {
  root: Root;
  props: MoklyViewerProps;
  ref: { current: MoklyViewerHandle | null };
  events: { name: string; value: unknown }[];
  render(): void;
  setSelection(value: ViewerSelection): void;
  options: HostOptions;
}
const hosts = new Map<string, Host>();
const data = (
  window as unknown as {
    fixture: { catalogue: CatalogueReadModel; baseUrl: string };
  }
).fixture;
const start = (id: string, options: HostOptions = {}) => {
  const element = document.createElement("section");
  element.id = id;
  element.style.cssText = "height:900px;width:1200px;position:relative";
  document.body.append(element);
  const ref = createRef<MoklyViewerHandle>();
  const events: Host["events"] = [];
  const log = (name: string, value: unknown = null) => {
    events.push({ name, value });
  };
  const state: ViewerSelection = {
    screenId: "home",
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
    render() {
      const node = <MoklyViewer {...host.props} ref={ref} />;
      host.root.render(options.strict ? <StrictMode>{node}</StrictMode> : node);
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
  host.props = {
    catalogue: options.source ?? data.catalogue,
    ...(options.source
      ? {}
      : { baseUrl: options.cross ? data.baseUrl : location.origin }),
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
    onError: (error) => log("error", error),
  } as MoklyViewerProps;
  if (options.slots)
    host.props.slots = {
      topBarStart: <button onClick={() => log("slot")}>Host start</button>,
      topBarEnd: <span>Host end</span>,
      railStart: <span>Rail start</span>,
      railEnd: <span>Rail end</span>,
      sidePanel: { content: <span>Side panel</span>, width: 240 },
      stageOverlay: { content: <span>Annotation</span>, pointerEvents: "none" },
      emptyState: <p>Host home</p>,
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
