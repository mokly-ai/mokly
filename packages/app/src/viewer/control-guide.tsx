import type { ReactNode } from "react";

/**
 * A write control and its optional secondary guide, as the Control with guide
 * composition of `folio-chrome.md` draws them: one row that wraps, so the
 * guide stays beside the control or moves immediately beneath it. Without a
 * guide the fragment is the control alone. At rest it stands alone; a refused
 * write puts the whole fragment in the write-failure fragment's control slot,
 * between the cause and Details, so the guide never falls below Details. A
 * refusal never adds a guide: the card that offers one decides.
 */
export function ControlWithGuide({
  control,
  guide,
}: {
  control: ReactNode;
  guide?: ReactNode;
}) {
  if (guide === undefined) return <>{control}</>;
  return (
    <div className="fo-control-guide">
      {control}
      {guide}
    </div>
  );
}
