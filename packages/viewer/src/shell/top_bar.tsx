/**
 * The shell's top bar. This container reads the store and the identifier
 * scope, and `@mokly/ui/top-bar` renders the bar, its compact search, and its
 * focus return. The tag picker sits in the search field, and the end control
 * is the standalone Appearance control. An embedded root has no end control:
 * the canvas shows both preview schemes at once, and a view that shows one
 * scheme keeps its own preview scheme control in its head band or its view
 * controls.
 */

import { TopBar as TopBarView } from "@mokly/ui/top-bar";

import { AppearanceSelect, type AppearanceState } from "./appearance.js";
import type { Catalogue } from "./catalogue.js";
import { useShellIdentifier } from "./identifier_context.js";
import { useShellStore } from "./store_context.js";
import { SearchTagPicker } from "./tags.js";

/** The shared 48px catalogue header keeps search available at every width. */
export function TopBar(props: {
  appearance?: AppearanceState;
  catalogue: Catalogue;
}) {
  const store = useShellStore();
  const navigationId = useShellIdentifier("mb-nav");
  const searchId = useShellIdentifier("mb-search");
  return (
    <TopBarView
      drawerOpen={store.state.drawerOpen}
      end={
        store.context.embedded ? null : (
          <AppearanceSelect
            ready={props.appearance?.ready ?? false}
            theme={props.appearance?.theme ?? "auto"}
            onChange={props.appearance?.onChange}
          />
        )
      }
      navigationId={navigationId}
      onDrawer={(open) => store.setDrawer(open)}
      onSearch={(query) => store.setSearch(query)}
      query={store.state.query}
      searchId={searchId}
      tagPicker={<SearchTagPicker tags={props.catalogue.tags} />}
    />
  );
}
