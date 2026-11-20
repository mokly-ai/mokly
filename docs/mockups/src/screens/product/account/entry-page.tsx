import { MockLink } from "@mokly/mokly";

import { stateScreenPath } from "../../../fixtures/product-states";

import { AccountEntry } from "./account-entry";
import { AccountShell } from "./account-shell";
import { entryCopy } from "./entry-layout";
import type { EntryMode, EntrySituation } from "./entry-layout";

/** One account-entry artboard; each screen entry names its own situation. */
export function EntryPage({
  mode,
  situation,
}: {
  mode: EntryMode;
  situation: EntrySituation;
}) {
  const copy = entryCopy[mode];
  return (
    <AccountShell
      id={stateScreenPath("product/account/" + mode, situation)}
      title={copy.title}
      identity={copy.identity}
      below={
        <p className="fo-account-switch">
          {copy.switchCopy}
          <MockLink to={copy.switchTo}>{copy.switchLabel}</MockLink>
        </p>
      }
    >
      <AccountEntry mode={mode} situation={situation} />
    </AccountShell>
  );
}
