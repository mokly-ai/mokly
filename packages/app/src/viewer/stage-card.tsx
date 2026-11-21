import type { ReactNode } from "react";

import { Pending } from "../components/page-parts";
import { StatePlaceholder } from "../components/placeholders";

/** The one card a cloud-owned fallback state draws inside the stage. */
export function StageCard({ children }: { children: ReactNode }) {
  return <div className="fo-stage-card">{children}</div>;
}

/**
 * The stage while one of its reads runs: the State card in its placeholder
 * form, with its glyph tile, its line and its action as placeholders, as the
 * catalogue's `StageWait` draws it. The answer decides which card the stage
 * shows, so the card's title is the stage's one text place that the answer
 * decides, and it names the read. The chrome around the stage stays.
 */
export function StageWait({ label }: { label: string }) {
  return (
    <StageCard>
      <Pending label={label}>
        {(name) => <StatePlaceholder title={name} size="md" />}
      </Pending>
    </StageCard>
  );
}
