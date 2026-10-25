/**
 * Presentation helpers over the protocol fixtures: the embedded viewer's first
 * render, the embedded shell once it holds details, and the dark views that a
 * light-only fixture entry gains.
 */

import { renderToStaticMarkup, renderToString } from "react-dom/server";

import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import type {
  CatalogueReadModel,
  EntryDetailV2,
} from "../src/catalogue/types.js";
import { EmbeddedViewerShell } from "../src/shell/embedded_viewer.js";
import { ShellStoreProvider } from "../src/shell/store.js";
import { viewRoute } from "../src/shell/store_initial.js";
import { MoklyViewer } from "../src/viewer/component.js";
import { viewerShellEnvironment } from "../src/viewer/environment.js";
import { viewerView } from "../src/viewer/projection.js";
import {
  defaultSelection,
  normalizeSelection,
} from "../src/viewer/selection.js";
import type {
  ViewerSelection,
  ViewerSlots,
  ViewerTheme,
} from "../src/viewer/types.js";

import {
  detailFixture,
  detailPairs,
  rawIndexFixture,
  shellModelFixture,
} from "./catalogue_v7_fixture.js";

/** The artifact origin an embedded render resolves its frame URLs against. */
const EMBEDDED_ORIGIN = "https://catalogue.example";

/** One embedded first render. */
export interface EmbeddedMarkupOptions {
  /** The raw index object a host passes; the protocol fixture by default. */
  index?: CatalogueReadModel;
  defaultSelection?: Partial<ViewerSelection>;
  slots?: ViewerSlots;
  theme?: ViewerTheme;
  /** The React root's id prefix, which keeps independent roots apart. */
  identifierPrefix?: string;
}

/**
 * Render the embedded viewer as a host's React renders it first. The render
 * holds no entry detail: the viewer requests the routed entry's detail only
 * after it mounts in the browser.
 */
export function embeddedMarkup(options: EmbeddedMarkupOptions = {}): string {
  return renderToString(
    <MoklyViewer
      baseUrl={EMBEDDED_ORIGIN}
      detail={(path, snapshotId) =>
        detailFixture({
          path,
          ...(snapshotId === undefined ? {} : { snapshotId }),
        })
      }
      index={options.index ?? rawIndexFixture()}
      {...(options.defaultSelection
        ? { defaultSelection: options.defaultSelection }
        : {})}
      {...(options.slots ? { slots: options.slots } : {})}
      {...(options.theme ? { theme: options.theme } : {})}
    />,
    options.identifierPrefix
      ? { identifierPrefix: options.identifierPrefix }
      : {},
  );
}

/** One embedded render after the routed entry's details arrived. */
export interface HeldEmbeddedMarkupOptions {
  /** The raw index object a host passes; the protocol fixture by default. */
  index?: CatalogueReadModel;
  /** The held details; every fixture detail by default. */
  details?: readonly (readonly [DetailRequest, EntryDetailV2])[];
  selection?: Partial<ViewerSelection>;
}

/**
 * Render the embedded shell as the viewer mounts it, once it holds the
 * routed entry's detail: the host selection, the embedded context, and frame
 * URLs resolved at the artifact origin.
 */
export function heldEmbeddedMarkup(
  options: HeldEmbeddedMarkupOptions = {},
): string {
  const index = readCatalogueIndex(options.index ?? rawIndexFixture());
  const root = new URL("/", EMBEDDED_ORIGIN);
  const selection = normalizeSelection(shellModelFixture(index, new Map()), {
    ...defaultSelection,
    ...options.selection,
  });
  return renderToStaticMarkup(
    <ShellStoreProvider
      context={{ embedded: true }}
      embeddedHost={viewerShellEnvironment(
        { index, root },
        selection,
        false,
        () => ({}),
        () => undefined,
      )}
      frameBaseUrl={root}
      index={index}
      initialDetails={options.details ?? detailPairs()}
      interactive={false}
      route={(catalogue) =>
        viewRoute(
          catalogue,
          viewerView(catalogue, selection),
          selection.snapshotId,
        )
      }
    >
      <EmbeddedViewerShell />
    </ShellStoreProvider>,
  );
}

/**
 * Each light view followed by its dark twin, which is the index and detail
 * axis order. A dark index view gets its own document key.
 */
export function withDarkViews<
  View extends { colorScheme: "light" | "dark"; documentKey?: string },
>(views: readonly View[]): View[] {
  return views.flatMap((view) => [
    view,
    {
      ...structuredClone(view),
      colorScheme: "dark" as const,
      ...(view.documentKey === undefined
        ? {}
        : { documentKey: [...view.documentKey].reverse().join("") }),
    },
  ]);
}
