/**
 * The shell's top bar. This container reads the store and the identifier
 * scope, and `@mokly/ui/top-bar` renders the bar, its compact search, and its
 * focus return. The tag picker sits in the search field, and the end control
 * is the standalone Appearance control. An embedded root has no end control
 * because the canvas shows both preview schemes at once. A view that shows
 * one scheme keeps its own preview scheme control in Inspect, such as a
 * document's Dark preview control in its head. An embedded root passes the
 * containers of its host's top-bar slots, which the bar places in its
 * columns. The search keys move focus to the search field through the bar's
 * handle. The bar has no menu: the dock of the compact layout opens the
 * catalogue's sheet.
 */

import { useRef } from "react";

import {
  TopBar as TopBarView,
  type TopBarHandle,
  type TopBarHost,
} from "@mokly/ui/top-bar";

import { AppearanceSelect, type AppearanceState } from "./appearance.js";
import type { Catalogue } from "./catalogue.js";
import { useShellIdentifier } from "./identifier_context.js";
import { useSearchKeys, useSearchShortcut } from "./search_keys.js";
import { useShellStore } from "./store_context.js";
import { SearchTagPicker } from "./tags.js";

/** The shared 48px catalogue header keeps search available at every width. */
export function TopBar(props: {
  appearance?: AppearanceState;
  catalogue: Catalogue;
  host?: TopBarHost;
}) {
  const store = useShellStore();
  const searchId = useShellIdentifier("mb-search");
  const bar = useRef<TopBarHandle>(null);
  useSearchKeys(bar);
  const searchShortcut = useSearchShortcut();
  return (
    <TopBarView
      end={
        store.context.embedded ? null : (
          <AppearanceSelect
            ready={props.appearance?.ready ?? false}
            theme={props.appearance?.theme ?? "auto"}
            onChange={props.appearance?.onChange}
          />
        )
      }
      host={props.host}
      onSearch={(query) => store.setSearch(query)}
      query={store.state.query}
      ref={bar}
      searchId={searchId}
      searchShortcut={searchShortcut}
      tagPicker={<SearchTagPicker tags={props.catalogue.tags} />}
    />
  );
}
