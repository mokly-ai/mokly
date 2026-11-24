/** React masks and labels for registry-backed workspace highlights. */

import type { InstanceBoundary } from "@mokly/frame";
import { canvasTagsShown } from "@mokly/ui/canvas-stage";
import { HighlightLabel, LabelLayer } from "@mokly/ui/highlight-label";
import { HighlightMask } from "@mokly/ui/highlight-mask";

import { visibleFrameBox } from "./component_geometry.js";
import { frameInspectionMask } from "./frame_inspection_mask.js";
import type { ShellFrameSession } from "./frame_registry.js";
import type { WorkspaceData } from "./workspace_data.js";

export interface WorkspaceHighlightLabel {
  id: string;
  key: string;
  left: number;
  /** The frame whose highlight the label names. */
  session: ShellFrameSession;
  text: string;
  top: number;
}

/**
 * Translate authenticated inner-frame boxes into outer viewport labels. A
 * frame drawn below the canvas's tag zoom draws no label, under the one rule
 * for the fixed-size tags on a frame: its highlight's outlines stay.
 */
export function workspaceHighlightLabels(
  data: WorkspaceData,
  measured: readonly {
    boundaries: readonly InstanceBoundary[];
    keys: readonly string[];
    session: ShellFrameSession;
  }[],
): readonly WorkspaceHighlightLabel[] {
  return measured.flatMap(({ boundaries, keys, session }) => {
    const viewport = session.identity.viewport;
    const usage = session.usage;
    const frame = session.element;
    const visible = visibleFrameBox(frame);
    if (
      !viewport ||
      usage.status !== "ready" ||
      !visible ||
      !frame.offsetWidth ||
      !frame.offsetHeight
    )
      return [];
    const rectangle = frame.getBoundingClientRect();
    const scaleX = rectangle.width / frame.offsetWidth;
    const scaleY = rectangle.height / frame.offsetHeight;
    if (!canvasTagsShown(scaleX)) return [];
    return keys.flatMap((key) => {
      const boundary = boundaries.find((item) => item.key === key);
      const box = boundary?.ranges.flatMap((range) => range.boxes)[0];
      const instance = usage.instances.find((item) => item.key === key);
      if (!box || !instance) return [];
      const left = rectangle.left + (box.x + frame.clientLeft) * scaleX;
      const top = rectangle.top + (box.y + frame.clientTop) * scaleY;
      if (
        left + box.width * scaleX <= visible.left ||
        top + box.height * scaleY <= visible.top ||
        left >= visible.right ||
        top >= visible.bottom
      )
        return [];
      const component = data.components.find(
        (item) => item.path === instance.componentId,
      );
      return [
        {
          id: JSON.stringify([session.generation, key]),
          key,
          left: Math.max(0, left),
          session,
          text: `${component?.title ?? "Component"} · ${instance.id}`,
          top: Math.max(0, top - 22),
        },
      ];
    });
  });
}

/** Keep label buttons declarative while their positions come from frame geometry. */
export function WorkspaceInspectionOverlay({
  labels,
  measured,
  onSelect,
}: {
  labels: readonly WorkspaceHighlightLabel[];
  measured: readonly {
    boundaries: readonly InstanceBoundary[];
    keys: readonly string[];
    session: ShellFrameSession;
  }[];
  onSelect(label: WorkspaceHighlightLabel): void;
}) {
  const masks = measured.flatMap(({ session, boundaries, keys }) => {
    const mask = frameInspectionMask(session, boundaries, keys);
    return mask ? [mask] : [];
  });
  if (!labels.length && !masks.length) return null;
  return (
    <>
      <LabelLayer placement="viewport">
        {labels.map((label) => (
          <HighlightLabel
            instanceKey={label.key}
            key={label.id}
            left={label.left}
            onSelect={() => onSelect(label)}
            text={label.text}
            top={label.top}
          />
        ))}
      </LabelLayer>
      {masks.map(({ generation, ...mask }) => (
        <HighlightMask key={generation} {...mask} />
      ))}
    </>
  );
}
