import type { PublicationState } from "../../../fixtures/publications";
import { Action } from "../page-parts";

import {
  Pill,
  PillChevron,
  PillDot,
  PillGlyph,
  pillName,
  PillReference,
  PillState,
} from "./pill";
import type { ReferenceKind } from "./pill";
import { compactLabel } from "./published-bar";
import type { SlotBar } from "./published-bar";

/** The drawing of the open switcher, which every publication pill opens. */
export const switcherPath = "product/viewer/switcher";

/**
 * The publication pill of one bar composition, which the fallback and the
 * published drawings share: one quiet registered Button that draws the
 * reference and what the stage shows of it as its own content, so a press
 * anywhere on the pill opens the switcher. The full pill draws the
 * reference's glyph, the whole reference and the publication's state with its
 * short SHA and the chevron; the compact pill draws the status dot, the
 * glyph, the reference's compact name and the chevron. In both, the Button is
 * named by the whole reference, the state's phrase and the short SHA, and the
 * pill's frame gives the same words as its tooltip. A glyph is drawn only once
 * a branch or pull request names the reference. A desktop drawing draws one
 * pill for each composition, so each keeps its own instance key.
 */
export function ReferenceTrigger({
  bar,
  kind,
  reference,
  meta,
  to,
}: {
  bar: SlotBar;
  kind?: ReferenceKind;
  /** The branch, or the pull request's number and title. */
  reference: string;
  /** What the pill says about the publication or build the stage shows. */
  meta: { state: PublicationState; detail: string; sha?: string };
  /** The catalogue entry the pill opens. A published slot opens none. */
  to?: string;
}) {
  const name = pillName(reference, meta);
  return (
    <Pill part={bar.part} title={name}>
      <Action
        instance={
          bar.compact ? "viewer-publication-compact" : "viewer-publication"
        }
        label={name}
        tone="quiet"
        size="sm"
        block
        to={to}
        content={
          <span className="fo-canvas-pill-content">
            {bar.compact && <PillDot state={meta.state} />}
            {kind && <PillGlyph kind={kind} />}
            <PillReference
              reference={bar.compact ? compactLabel(reference) : reference}
              kind={kind}
            />
            {bar.compact ? (
              <PillChevron />
            ) : (
              <PillState
                state={meta.state}
                detail={meta.detail}
                sha={meta.sha}
              />
            )}
          </span>
        }
      />
    </Pill>
  );
}
