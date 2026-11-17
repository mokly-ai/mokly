import type { Screen, ShareLink } from "../api/types";
import type { PagedItems } from "../data/publications";
import type { KeyedResource, Resource } from "../data/use-resource";
import type { ViewerSelection } from "./host";
import { shareableScreen } from "./screens";
import type { SelectionDefaults } from "./selection";
import { shareSelection } from "./share-selection";

interface ShareInput {
  walk: Resource<PagedItems<Screen>>;
  selection: ViewerSelection;
  defaults: SelectionDefaults;
  comparable: boolean;
  publicationId?: string;
}

interface ShareRequest {
  key: string;
  selection: ReturnType<typeof shareSelection>;
}

/** The one request and display decision shared by the panel and its tests. */
export interface ShareState {
  key: string;
  request?: ShareRequest;
  screen?: string;
  empty: boolean;
  visible: Resource<ShareLink>;
}

/** Screen membership and the held link must belong to the settled selection. */
export function shareLinkState(
  input: ShareInput,
  held?: KeyedResource<ShareLink>,
): ShareState {
  const { walk, selection, defaults, comparable, publicationId } = input;
  const screen = shareableScreen(walk, comparable, selection);
  const chosen = shareSelection(selection, defaults, screen);
  const key = [
    "viewer-share",
    publicationId ?? "none",
    chosen.screen ?? "",
    chosen.viewport ?? "",
    chosen.scheme ?? "",
  ].join(":");
  const waiting =
    comparable && selection.screen !== undefined && walk.status === "loading";
  const request =
    publicationId !== undefined && !waiting
      ? { key, selection: chosen }
      : undefined;
  return {
    key,
    request,
    screen: screen?.path,
    empty: publicationId === undefined && defaults.publication !== undefined,
    visible:
      request !== undefined && held?.key === key
        ? held.state
        : { status: "loading" },
  };
}
