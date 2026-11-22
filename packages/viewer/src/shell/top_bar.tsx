/**
 * The shell's top bar. This container reads the store and the identifier
 * scope, and `@mokly/ui/top-bar` renders the bar, its compact search, and its
 * focus return. The tag picker sits in the search field, and the end control
 * is the standalone Appearance control or, in an embedded root of a catalogue
 * with dark previews, the preview scheme switch. An embedded root passes the
 * containers of its host's top-bar slots, which the bar places in its columns.
 */

import { TopBar as TopBarView, type TopBarHost } from "@mokly/ui/top-bar";

import { AppearanceSelect, type AppearanceState } from "./appearance.js";
import type { Catalogue } from "./catalogue.js";
import { SchemeSwitch } from "./head.js";
import { useShellIdentifier } from "./identifier_context.js";
import { useShellStore } from "./store_context.js";
import { SearchTagPicker } from "./tags.js";

/** The shared 48px catalogue header keeps search available at every width. */
export function TopBar(props: {
  appearance?: AppearanceState;
  catalogue: Catalogue;
  host?: TopBarHost;
}) {
  const store = useShellStore();
  const navigationId = useShellIdentifier("mb-nav");
  const searchId = useShellIdentifier("mb-search");
  return (
    <TopBarView
      drawerOpen={store.state.drawerOpen}
      end={
        store.context.embedded ? (
          props.catalogue.hasDarkFragments ? (
            <SchemeSwitch />
          ) : null
        ) : (
          <AppearanceSelect
            ready={props.appearance?.ready ?? false}
            theme={props.appearance?.theme ?? "auto"}
            onChange={props.appearance?.onChange}
          />
        )
      }
      host={props.host}
      navigationId={navigationId}
      onDrawer={(open) => store.setDrawer(open)}
      onSearch={(query) => store.setSearch(query)}
      query={store.state.query}
      searchId={searchId}
      tagPicker={<SearchTagPicker tags={props.catalogue.tags} />}
    />
  );
}
