/**
 * A use case's canvas: one section of its step frames in one row, which pans,
 * zooms and fits as a screen's section does, at and above the layout
 * breakpoint and in the compact layout. The section head names the use case
 * with its title, its path and its change status, and no kind tag. Each step
 * frame is mounted by `canvas_use_case_frame.tsx`.
 *
 * The use case shows its own Frames choice, apart from a screen's frames and
 * from the selection's preview scheme: the choice that it opens on, Desktop
 * and Light at and above the layout breakpoint, and Mobile and Light in the
 * compact layout.
 */

import type { CatalogueUseCase } from "@mokly/model";

import { DESKTOP_FRAME_SIZE, MOBILE_FRAME_SIZE } from "./canvas_frame_size.js";
import { useCanvasLayout } from "./canvas_layout.js";
import { CanvasEntryStage } from "./canvas_stage.js";
import { CanvasUseCaseFrame } from "./canvas_use_case_frame.js";
import {
  openingUseCaseChoice,
  useCaseFrames,
} from "./canvas_use_case_frames.js";
import type { Catalogue } from "./catalogue.js";
import { targetHead } from "./head.js";
import { publicEntryStatus } from "./public_workspace.js";

export function CanvasUseCaseStage({
  catalogue,
  entry,
  fragment,
}: {
  catalogue: Catalogue;
  entry: CatalogueUseCase;
  fragment?: string | undefined;
}) {
  const choice = openingUseCaseChoice(useCanvasLayout());
  const head = targetHead(catalogue, { kind: "entry", entry });
  const size =
    choice.viewport === "desktop" ? DESKTOP_FRAME_SIZE : MOBILE_FRAME_SIZE;
  return (
    <CanvasEntryStage
      fitKey={`${entry.path}:${choice.viewport}:${choice.scheme}`}
      frames={useCaseFrames(catalogue.publicModel.screens, entry, choice).map(
        (plan) => ({
          column: plan.column,
          height: size.height,
          key: plan.key,
          node: (
            <CanvasUseCaseFrame
              fragment={plan.step.index === 0 ? fragment : undefined}
              hasDarkFragments={catalogue.hasDarkFragments}
              plan={plan}
              size={size}
            />
          ),
          row: plan.row,
          width: size.width,
        }),
      )}
      kind="use-case"
      path={head.path}
      status={publicEntryStatus(entry)}
      title={head.title}
    />
  );
}
