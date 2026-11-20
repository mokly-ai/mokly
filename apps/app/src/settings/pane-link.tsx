import { Action } from "../components/action";
import type { ActionTone } from "../components/action";

import { useSettings } from "./context";
import type { SurfaceId } from "./panes";

/**
 * A pane's way of sending the reader to another pane.
 *
 * It takes a pane rather than an address, so a pane cannot address anything
 * outside settings: switching panes keeps what the reader has typed and asks
 * nothing, which is only true while the destination is another pane. Anywhere
 * else is a way out of settings, and those go through the host — `leaveTo`,
 * `leaveBy` or `leaveConfirmed` — so the reader is asked about unsaved work
 * first.
 */
export function PaneLink({
  label,
  to,
  tone,
  size = "sm",
}: {
  label: string;
  to: SurfaceId;
  tone?: ActionTone;
  size?: "sm" | "md" | "lg";
}) {
  const { goToPane } = useSettings();
  // The host decides whether reaching a pane is a step the reader can take
  // back, so a pane cannot choose its own history any more than its own
  // destination.
  return (
    <Action
      label={label}
      tone={tone}
      size={size}
      onPress={() => goToPane(to)}
    />
  );
}
