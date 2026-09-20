// The one previous-version presentation shared by removed documents and
// removed screens. The shell renders the label, the stage host that carries the
// advertised preview descriptor, and the device chrome a screen preview clones;
// the browser client fills the host with the historical document.

import type { RemovedEntryPreview } from "../catalogue/types.js";
import type { ManifestEntry } from "../registry/types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { BrowserFrame, PhoneFrame } from "./frames.js";

/** Everything the browser client needs to request one entry's previous version. */
export interface RemovedPreviewData {
  /** Stable entry id, so a reused route cannot adopt another entry's response. */
  id: string;
  kind: "page" | "screen";
  route: string;
  title: string;
  /** Address shown in a screen preview's browser chrome. */
  address?: string;
  /** The delivery's advertised descriptor; absent when nothing is published. */
  published?: RemovedEntryPreview;
}

/**
 * Describe a removed page or screen from the accepted public catalogue. Static
 * delivery loads only what the catalogue advertises, so an entry without a
 * published descriptor is reported as having none rather than guessing a path.
 */
export function removedPreviewData(
  catalogue: Catalogue,
  context: ShellContext,
  entry: Exclude<ManifestEntry, { kind: "collection" }>,
): RemovedPreviewData | undefined {
  if (entry.kind !== "page" && entry.kind !== "screen") return undefined;
  const model = catalogue.publicModel ?? context.readModel;
  const published = model?.removedEntries.find(
    (removed) => removed.entry.route === entry.route,
  )?.preview;
  return {
    id: entry.id,
    kind: entry.kind,
    route: entry.route,
    title: entry.title,
    ...(entry.kind === "screen" && entry.address
      ? { address: entry.address }
      : {}),
    ...(published ? { published } : {}),
  };
}

/** The quiet band naming what the stage below it holds. */
function PreviousVersionLabel() {
  return <p className="mbk-previous">Showing previous version</p>;
}

/**
 * The stage a removed entry opens in. The served markup says the previous
 * version is unavailable, because a shell whose client never runs has nothing
 * on the way; the client's first update replaces it with the loading state and
 * then with the previous version, since opening a removed entry is the request.
 */
export function RemovedPreviewStage(props: { data: RemovedPreviewData }) {
  return (
    <>
      <PreviousVersionLabel />
      <div
        aria-live="polite"
        className="mbk-preview"
        data-mokly-preview={JSON.stringify(props.data)}
        data-mokly-stage=""
        data-viewport="both"
      >
        <div className="mbk-stage">
          <div className="mbk-empty">
            <h2>Previous version unavailable</h2>
            <p>The previous version could not be loaded.</p>
            <button
              className="mbk-empty-link"
              data-mokly-preview-retry=""
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
      {props.data.kind === "screen" ? (
        <>
          <template data-mokly-preview-template="mobile">
            <PhoneFrame />
          </template>
          <template data-mokly-preview-template="desktop">
            <BrowserFrame
              address={props.data.address ?? props.data.route}
              expandable={false}
            />
          </template>
        </>
      ) : null}
    </>
  );
}
