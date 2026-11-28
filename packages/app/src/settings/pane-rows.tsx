import { ContentList } from "../components/controls";

import { useSettings } from "./context";
import type { PaneDefinition } from "./panes";

/**
 * A list of panes the reader can open, as the settings index draws them.
 *
 * Like `PaneLink`, it takes panes rather than addresses, so the index cannot
 * name anything outside settings; and it follows the surface's own rule about
 * whether reaching a pane is a step the reader can take back, so the index and
 * the rail behave the same way.
 */
export function PaneRows({
  label,
  panes,
}: {
  label: string;
  panes: readonly PaneDefinition[];
}) {
  const { href, goToPane } = useSettings();
  return (
    <ContentList
      label={label}
      rows={panes.map((pane) => ({
        id: pane.id,
        title: pane.title,
        detail: pane.summary,
        href: href(pane.id),
        onFollow: () => goToPane(pane.id),
      }))}
    />
  );
}
