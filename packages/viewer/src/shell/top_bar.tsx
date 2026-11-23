/**
 * The shell's top bar. This container reads the store and the identifier
 * scope, and `@mokly/ui/top-bar` renders the bar, its compact search, and its
 * focus return. The tag picker sits in the search field, and the end control
 * is the standalone Appearance control or, in an embedded root of a catalogue
 * with dark previews, the preview scheme switch.
 */

import { useMemo } from "react";

import { TopBar as TopBarView } from "@mokly/ui/top-bar";

import { AppearanceSelect, type AppearanceState } from "./appearance.js";
import type { Catalogue } from "./catalogue.js";
import { SchemeSwitch } from "./head.js";
import { useShellIdentifier } from "./identifier_context.js";
import { useLatestShellStore, useShellStore } from "./store_context.js";
import { SearchTagPicker } from "./tags.js";

/** The shared 48px catalogue header keeps search available at every width. */
export function TopBar(props: {
  appearance?: AppearanceState;
  catalogue: Catalogue;
}) {
  const store = useShellStore();
  const latest = useLatestShellStore(store);
  const navigationId = useShellIdentifier("mb-nav");
  const searchId = useShellIdentifier("mb-search");
  const { embedded } = store.context;
  const { drawerOpen, query } = store.state;
  const { hasDarkFragments, tags } = props.catalogue;
  const ready = props.appearance?.ready ?? false;
  const theme = props.appearance?.theme ?? "auto";
  const onChange = props.appearance?.onChange;
  const end = useMemo(
    () =>
      embedded ? (
        hasDarkFragments ? (
          <SchemeSwitch />
        ) : null
      ) : (
        <AppearanceSelect ready={ready} theme={theme} onChange={onChange} />
      ),
    [embedded, hasDarkFragments, onChange, ready, theme],
  );
  const tagPicker = useMemo(() => <SearchTagPicker tags={tags} />, [tags]);
  return useMemo(
    () => (
      <TopBarView
        drawerOpen={drawerOpen}
        end={end}
        navigationId={navigationId}
        onDrawer={(open) => latest.current.setDrawer(open)}
        onSearch={(query) => latest.current.setSearch(query)}
        query={query}
        searchId={searchId}
        tagPicker={tagPicker}
      />
    ),
    [drawerOpen, end, latest, navigationId, query, searchId, tagPicker],
  );
}
