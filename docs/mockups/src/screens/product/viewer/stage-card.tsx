import type { ReactNode } from "react";

import { Pending } from "../page-parts";
import { StatePlaceholder } from "../placeholders";

/**
 * The one card the cloud fallback owns. The published package renders a ready
 * catalogue; every other state centres a single card in the fallback canvas.
 */
export function StageCard({ children }: { children: ReactNode }) {
  return <div className="fo-stage-card">{children}</div>;
}

/**
 * The stage while one of its reads runs: the State card in its placeholder
 * form, with its glyph tile, its line and its action as placeholders. The
 * answer decides which card the stage shows, so the card's title is the
 * stage's one text place that the answer decides, and it names the read. The
 * chrome around the stage stays.
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
