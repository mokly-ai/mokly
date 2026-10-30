/**
 * The shell's top bar. This container reads the store and the identifier
 * scope, and `@mokly/ui/top-bar` renders the bar, its compact search, and its
 * focus return. The tag picker sits in the search field, and the end control
 * is the standalone Appearance control or, in an embedded root of a catalogue
 * with dark previews, the preview scheme switch.
 */

import { TopBar as TopBarView } from "@mokly/ui/top-bar";

import type { StandaloneAppearanceState } from "../standalone/appearance_bridge.js";

import { AppearanceSelect } from "./appearance.js";
import type { Catalogue } from "./catalogue.js";
import { SchemeSwitch } from "./head.js";
import { useShellIdentifier } from "./identifier_context.js";
import { useOptionalShellStore } from "./store_context.js";
import { SearchTagPicker } from "./tags.js";

/** The shared 48px catalogue header keeps search available at every width. */
export function TopBar(props: {
  appearance?: StandaloneAppearanceState;
  catalogue: Catalogue;
}) {
  const store = useOptionalShellStore();
  const navigationId = useShellIdentifier("mb-nav");
  const searchId = useShellIdentifier("mb-search");
  return (
    <TopBarView
      drawerOpen={store?.state.drawerOpen ?? false}
      end={
        store?.context.embedded ? (
          props.catalogue.hasDarkFragments ? (
            <SchemeSwitch />
          ) : null
        ) : (
          <AppearanceSelect
            ready={props.appearance?.ready ?? false}
            theme={props.appearance?.theme ?? "auto"}
          />
        )
      }
      navigationId={navigationId}
      onDrawer={(open) => store?.setDrawer(open)}
      onSearch={(query) => store?.setSearch(query)}
      query={store?.state.query}
      searchId={searchId}
      tagPicker={<SearchTagPicker tags={props.catalogue.tags} />}
    />
  );
}
