import { Pending } from "../../components/page-parts";
import { StatePlaceholder } from "../../components/placeholders";
import { AccountShell } from "../account/account-shell";
import type { WaitingIdentity } from "../account/account-shell";

/**
 * A resolver's wait, which every read it makes draws, the session read
 * included: its title over one state card placeholder, because its success
 * replaces the route and leaves no layout of its own to wait for. Its title
 * already says what it opens, so the card's title is a bar and screen readers
 * hear the name.
 */
export function ResolverWait({
  screen,
  title,
  identity,
}: {
  screen: string;
  title: string;
  identity: WaitingIdentity;
}) {
  return (
    <AccountShell screen={screen} title={title} identity={identity}>
      <Pending label="Opening your project" labelMode="screen-reader-only">
        <StatePlaceholder />
      </Pending>
    </AccountShell>
  );
}
