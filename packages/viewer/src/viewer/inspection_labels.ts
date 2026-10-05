/** Component labels for authenticated public-viewer frame geometry. */

import { branchPoints } from "../catalogue/branch_point.js";
import {
  readCurrentPath,
  readBranchPointPath,
} from "../catalogue/path_values.js";
import type {
  CatalogueReadModel,
  CatalogueRecord,
} from "../catalogue/types.js";
import type { Box } from "../client/frame_adapter.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../shell/frame_registry.js";

interface InspectionLabel {
  boxes: readonly Box[];
  id: string;
  key: string;
  left: number;
  session: ShellFrameSession;
  text: string;
  top: number;
}

/** Resolve usage names on the owning frame record's side before labelling it. */
export function viewerInspectionLabels(
  model: CatalogueReadModel,
  layer: HTMLElement,
  measured: readonly {
    keys: readonly string[];
    session: ShellFrameSession;
  }[],
  registry: ShellFrameRegistry,
): readonly InspectionLabel[] {
  const origin = layer.getBoundingClientRect();
  return measured.flatMap(({ keys, session }) => {
    const result = registry.geometry.snapshot(session).result;
    const frame = session.element;
    if (
      result?.kind !== "ready" ||
      !frame.getClientRects().length ||
      !frame.offsetWidth ||
      !frame.offsetHeight ||
      session.usage.status !== "ready"
    )
      return [];
    const rectangle = frame.getBoundingClientRect();
    const scaleX = rectangle.width / frame.offsetWidth;
    const scaleY = rectangle.height / frame.offsetHeight;
    return keys.flatMap((key) => {
      const boundary = result.boundaries.find((item) => item.key === key);
      const boxes = boundary?.ranges.flatMap(({ boxes }) => boxes) ?? [];
      const box = boxes[0];
      const instance =
        session.usage.status === "ready"
          ? session.usage.instances.find((item) => item.key === key)
          : undefined;
      if (!box || !instance) return [];
      const left = rectangle.left + (box.x + frame.clientLeft) * scaleX;
      const top = rectangle.top + (box.y + frame.clientTop) * scaleY;
      const historical = model.removedEntries.some(
        ({ entry }) =>
          entry.path ===
          (session.identity.variantPath ?? session.identity.entryPath),
      );
      const component = branchPoints<
        CatalogueRecord,
        CatalogueReadModel["removedEntries"][number]
      >(model).usageComponent(
        historical
          ? readBranchPointPath(instance.componentId)
          : readCurrentPath(instance.componentId),
        historical ? "before" : "after",
      )?.entry;
      return [
        {
          boxes,
          id: JSON.stringify([session.generation, key]),
          key,
          left: left - origin.left,
          session,
          text: `${component?.title ?? "Component"} · ${instance.id}`,
          top: Math.max(0, top - origin.top - 22),
        },
      ];
    });
  });
}
