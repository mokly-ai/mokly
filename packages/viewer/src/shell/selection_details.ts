/**
 * What Inspect's Selection section and the compact layout's pill say of the
 * canvas selection: a selected instance's component, frame, supplied props
 * and slots, size, box model and source file, or a selected frame's size,
 * variant and scheme. The sizes are whole CSS pixels.
 */

import type { ComponentInstanceRecord } from "@mokly/model";
import type { InspectSelectionState } from "@mokly/ui/inspect-selection";

import { decodeProps } from "../components/codec.js";
import type { ComponentViewRecord } from "../components/view_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import { viewHref } from "../navigation/routes.js";

import type { CanvasFrameSize } from "./canvas_frame_size.js";
import {
  framesViews,
  viewportFrameLabel,
  type CanvasFramePlan,
} from "./canvas_frames.js";
import type { CanvasSelected } from "./canvas_selection.js";
import type { InstanceBoxReading } from "./instance_box_model.js";
import { SCHEME_LABELS } from "./view_marks.js";
import type { WorkspaceData } from "./workspace_data.js";
import { propValues } from "./workspace_props.js";

/** The selected instance's record and its frame's usage, if they are known. */
export interface SelectedInstanceRecord {
  instance: ComponentInstanceRecord;
  plan: CanvasFramePlan;
  usage: ComponentViewRecord;
}

/**
 * The record of the selected instance on its frame, from the views that the
 * frames show, an edit's renders included.
 */
export function selectedInstanceRecord(
  selected: CanvasSelected | undefined,
  plans: readonly CanvasFramePlan[],
  views: readonly GeneratedComponentView[],
): SelectedInstanceRecord | undefined {
  if (selected?.kind !== "instance") return undefined;
  const plan = plans.find((candidate) => candidate.key === selected.frame);
  const usage = plan
    ? framesViews(views, [{ ...plan, hidden: false }])[0]?.usage
    : undefined;
  const instance = usage?.instances.find(
    (candidate) => candidate.key === selected.key,
  );
  return plan && usage && instance ? { instance, plan, usage } : undefined;
}

/** A frame's name in the Selection section, without the compact slug. */
function frameName(plan: CanvasFramePlan): string {
  return plan.kind === "component"
    ? plan.label
    : viewportFrameLabel(plan.viewport, plan.scheme);
}

/** What the Selection section shows. */
export function selectionDetails({
  data,
  frameSize,
  plans,
  reading,
  record,
  selected,
  sourceOf,
}: {
  data: WorkspaceData;
  /** The nominal size of a frame, by its key. */
  frameSize(key: string): CanvasFrameSize;
  /** The source file of a component, by its path. */
  sourceOf(path: string): string | undefined;
  plans: readonly CanvasFramePlan[];
  reading: InstanceBoxReading | undefined;
  record: SelectedInstanceRecord | undefined;
  selected: CanvasSelected | undefined;
}): InspectSelectionState {
  if (selected?.kind === "frame") {
    const plan = plans.find((candidate) => candidate.key === selected.frame);
    if (!plan) return { kind: "none" };
    const nominal = frameSize(plan.key);
    return {
      kind: "frame",
      scheme: SCHEME_LABELS[plan.scheme],
      size: {
        height: Math.round(nominal.height),
        width: Math.round(nominal.width),
      },
      variant: plan.entry.title,
    };
  }
  if (!record) return { kind: "none" };
  const { instance, plan, usage } = record;
  const component = data.components.find(
    (candidate) => candidate.path === instance.componentId,
  );
  const values = decodeProps(instance.props);
  const sizes = reading?.sizes;
  const source = sourceOf(instance.componentId);
  return {
    kind: "instance",
    ...(sizes
      ? {
          boxModel: {
            ...sizes.padding,
            height: sizes.contentHeight,
            width: sizes.contentWidth,
          },
        }
      : {}),
    component: {
      ...(component ? { href: viewHref(component.path) } : {}),
      title: component?.title ?? instance.componentId,
    },
    frame: frameName(plan),
    props: propValues(Object.keys(values), values),
    ...(reading
      ? {
          size: {
            height: Math.round(reading.box.height),
            width: Math.round(reading.box.width),
          },
        }
      : {}),
    slots: usage.slots
      .filter((slot) => slot.instanceKey === instance.key)
      .map(
        (slot) =>
          `${slot.name} · ${
            slot.owner.kind === "entry"
              ? "Supplied by this page"
              : "Supplied by a parent component"
          }`,
      ),
    ...(source ? { source } : {}),
  };
}

/** What the compact layout's pill names of a selected instance. */
export function pillDetails(
  details: InspectSelectionState,
  reading: InstanceBoxReading | undefined,
):
  | {
      component: string;
      padding?: number;
      prop?: { name: string; value: string };
    }
  | undefined {
  if (details.kind !== "instance") return undefined;
  const [first] = details.props;
  const padding = reading?.sizes?.padding.left;
  return {
    component: details.component.title,
    ...(padding === undefined ? {} : { padding }),
    ...(first ? { prop: first } : {}),
  };
}
