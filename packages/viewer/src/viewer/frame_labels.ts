import type { CatalogueReadModel } from "../catalogue/types.js";
import type { Box, FrameEvent } from "../client/frame_adapter.js";

import type { Session } from "./frame_session.js";
import type { ViewerFrame } from "./frame_views.js";
import { highlightKeys } from "./highlight_request.js";
import type { HighlightRequest } from "./highlight_request.js";

/** Reuse the shell's label buttons; label text comes exclusively from catalogue data. */
export function drawFrameLabels(
  layer: HTMLElement,
  frames: readonly {
    frame: ViewerFrame;
    boxes: readonly { key: string; boxes: readonly Box[] }[];
  }[],
  model: CatalogueReadModel,
  choose: (frame: ViewerFrame, key: string) => void,
): void {
  layer.replaceChildren();
  const bounds = layer.getBoundingClientRect();
  for (const { frame, boxes } of frames) {
    const rectangle = frame.element.getBoundingClientRect();
    if (!frame.element.getClientRects().length) continue;
    const scale = rectangle.width / frame.element.offsetWidth;
    for (const region of boxes) {
      const box = region.boxes[0];
      if (!box || frame.view?.usage.status !== "ready") continue;
      const instance = frame.view.usage.instances.find(
        (item) => item.key === region.key,
      );
      const component = model.components.find(
        (item) => item.id === instance?.componentId,
      );
      const button = layer.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "mbk-highlight-label";
      button.textContent = `${component?.title ?? "Component"} · ${instance?.id ?? ""}`;
      button.style.left = `${rectangle.left - bounds.left + box.x * scale}px`;
      button.style.top = `${Math.max(0, rectangle.top - bounds.top + box.y * scale - 22)}px`;
      button.style.pointerEvents = "auto";
      button.addEventListener("click", () => choose(frame, region.key));
      layer.append(button);
    }
  }
}

export async function renderFrameLabels(
  root: HTMLElement,
  sessions: readonly Session[],
  model: CatalogueReadModel,
  selected: HighlightRequest,
  active: () => boolean,
  receive: (frame: ViewerFrame, event: FrameEvent) => void,
): Promise<void> {
  const regions = await Promise.all(
    sessions.map(async ({ frame, mounted }) => ({
      frame,
      boxes: (await mounted!.listInstanceBoundaries())
        .filter((item) => highlightKeys(frame, selected).includes(item.key))
        .map((item) => ({
          key: item.key,
          boxes: item.ranges.flatMap((range) => range.boxes),
        })),
    })),
  );
  const layer = root.querySelector<HTMLElement>("[data-mokly-label-layer]");
  if (layer && active())
    drawFrameLabels(layer, regions, model, (frame, key) => {
      if (!active()) return;
      const boxes =
        regions
          .find((item) => item.frame === frame)
          ?.boxes.find((item) => item.key === key)?.boxes ?? [];
      receive(frame, { type: "click", key, boxes });
    });
}
