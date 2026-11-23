/**
 * A use case's stage from the validated public catalogue model. This
 * container chooses the frames; `@mokly/ui/flow-step` draws a user flow's
 * steps. Every other entry stands on the canvas.
 */

import { useRef } from "react";

import { FlowStage, FlowStep } from "@mokly/ui/flow-step";

import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
} from "../catalogue/scoped_types.js";
import { viewHref } from "../navigation/routes.js";

import { FrameStageContext } from "./frame_layout_context.js";
import { useNarrowLayout } from "./narrow_layout.js";
import { useShellRoot } from "./root_context.js";
import { StageFrame } from "./stage_frame.js";

/** Render a use case's steps without giving consumer documents script capability. */
export function PublicStage({
  catalogue,
  entry,
  fragment,
  hasDarkFragments,
}: {
  catalogue: ShellCatalogueReadModel;
  entry: Extract<ShellCatalogueRoutedEntry, { kind: "use-case" }>;
  fragment?: string;
  hasDarkFragments: boolean;
}) {
  return (
    <UseCaseFlow
      catalogue={catalogue}
      entry={entry}
      hasDarkFragments={hasDarkFragments}
      {...(fragment ? { fragment } : {})}
    />
  );
}

/**
 * Each step shows its screen's desktop view in a browser frame, or below
 * 760px its mobile view in a phone frame.
 */
function UseCaseFlow({
  catalogue,
  entry,
  fragment,
  hasDarkFragments,
}: {
  catalogue: ShellCatalogueReadModel;
  entry: Extract<ShellCatalogueRoutedEntry, { kind: "use-case" }>;
  fragment?: string;
  hasDarkFragments: boolean;
}) {
  const elements = useShellRoot()?.elements;
  const localStage = useRef<HTMLDivElement>(null);
  const stage = elements?.scrolls.ref("flow") ?? localStage;
  const viewport = useNarrowLayout() ? "mobile" : "desktop";
  return (
    <FrameStageContext value={stage}>
      <FlowStage ref={stage}>
        {entry.steps.map((step, index) => {
          // Each step of a current use case names a current screen.
          const screen = catalogue.screens.find(
            (candidate) => candidate.path === step.screenPath,
          )!;
          return (
            <FlowStep
              description={step.description ?? screen.details.description}
              key={`${step.screenPath}-${index}`}
              number={index + 1}
              screen={{ href: viewHref(screen.path), title: screen.title }}
              title={step.title ?? screen.title}
            >
              <StageFrame
                entry={screen}
                flow
                hasDarkFragments={hasDarkFragments}
                key={`${screen.path}:${index}:${viewport}`}
                stepIndex={index}
                views={screen.views}
                viewport={viewport}
                {...(index === 0 && fragment ? { fragment } : {})}
              />
            </FlowStep>
          );
        })}
      </FlowStage>
    </FrameStageContext>
  );
}
