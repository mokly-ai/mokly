/** Inspector content comes solely from the selected render's recorded usage. */
import { decodeProps } from "../components/codec.js";
import type {
  ComponentInstanceRecord,
  ComponentViewRecord,
} from "../components/manifest_types.js";
import type { ComponentWireProps } from "../components/prop_types.js";
import { orderedInstances } from "../components/views.js";
import type { UsageLink, WorkspaceData } from "../shell/workspace_data.js";

import { propText } from "./prop_display.js";

export interface InspectorSelection {
  usage?: ComponentViewRecord;
  instance?: ComponentInstanceRecord;
  props?: ComponentWireProps;
  slots?: readonly string[];
}
export function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const item = doc.createElement(tag);
  if (text !== undefined) item.textContent = text;
  return item;
}
export function usageHref(link: UsageLink): string {
  const query = new URLSearchParams({
    viewport: link.viewport,
    scheme: link.colorScheme,
    instance: link.instanceKey,
  });
  if (link.variantId) query.set("variant", link.variantId);
  if (link.removed && link.comparisonEligible) query.set("comparison", "side");
  return `/view/${link.route.split("/").map(encodeURIComponent).join("/")}?${query}`;
}
export function renderUsage(panel: HTMLElement, data: WorkspaceData): void {
  const doc = panel.ownerDocument;
  panel.replaceChildren();
  if (data.usageComplete === false) {
    const status = element(
      doc,
      "p",
      "Usage is unavailable until the catalogue has been checked.",
    );
    status.dataset["usageSection"] = "status";
    panel.append(status);
    return;
  }
  for (const [key, title, links] of [
    ["used-by", "Used by", data.usedBy],
    ["affected", "Affected screens and components", data.affected],
  ] as const) {
    if (title !== "Used by" && links.length === 0) continue;
    const section = element(doc, "section");
    section.dataset["usageSection"] = key;
    section.append(element(doc, "h3", title));
    if (!links.length) {
      section.append(element(doc, "p", "No recorded consumers."));
      panel.append(section);
      continue;
    }
    const list = element(doc, "ul");
    list.className = "mbk-usage-list";
    const groups = new Map<string, UsageLink[]>();
    for (const item of links) {
      const key = `${item.route}|${item.variantId ?? ""}|${item.removed}|${item.comparisonEligible}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const values of groups.values()) {
      const first = values[0]!;
      const row = element(doc, "li");
      row.dataset["usageLink"] = JSON.stringify([
        first.route,
        first.variantId ?? "",
        first.removed,
      ]);
      const link = element(
        doc,
        "a",
        `${first.title}${first.variantId ? ` · ${first.variantId}` : ""}${first.removed ? " · Removed" : ""}`,
      );
      link.href = usageHref(first);
      row.append(
        link,
        element(
          doc,
          "small",
          `${values.some((value) => value.direct) ? "Direct use" : "Nested use"} · ${new Set(values.map((value) => value.instanceKey)).size} instances · ${new Set(values.map((value) => `${value.viewport}/${value.colorScheme}`)).size} views`,
        ),
      );
      list.append(row);
    }
    section.append(list);
    panel.append(section);
  }
}
export function renderInstances(
  panel: HTMLElement,
  data: WorkspaceData,
  selection: InspectorSelection,
  select: (key: string) => void,
  expanded: Set<string>,
  focusNested: (key: string) => void,
): void {
  const doc = panel.ownerDocument;
  panel.replaceChildren();
  const usage = selection.usage;
  if (!usage) {
    panel.append(
      element(doc, "p", "Component inspection is unavailable for this view."),
    );
    return;
  }
  if (!usage.instances.length) {
    panel.append(
      element(doc, "p", "No registered components are used in this view."),
    );
    return;
  }
  panel.append(
    element(
      doc,
      "p",
      `${usage.instances.length} instances · ${new Set(usage.instances.map((instance) => instance.componentId)).size} components`,
    ),
  );
  const build = (owner?: string): HTMLUListElement => {
    const list = element(doc, "ul");
    list.className = "mbk-instance-tree";
    for (const instance of orderedInstances(usage).filter((item) =>
      owner
        ? item.owner.kind === "instance" && item.owner.instanceKey === owner
        : item.owner.kind === "entry",
    )) {
      const component = data.components.find(
        (item) => item.id === instance.componentId,
      );
      const row = element(doc, "li");
      const button = element(
        doc,
        "button",
        `${component?.title ?? instance.componentId} · ${instance.id}`,
      );
      button.type = "button";
      button.className = "mbk-instance-select";
      button.dataset["instanceKey"] = instance.key;
      button.setAttribute(
        "aria-pressed",
        String(selection.instance?.key === instance.key),
      );
      button.addEventListener("click", () => select(instance.key));
      row.append(button);
      const children = build(instance.key);
      if (children.childElementCount) {
        const details = element(doc, "details");
        details.open = expanded.has(instance.key);
        details.append(
          element(
            doc,
            "summary",
            `${children.childElementCount} nested instances`,
          ),
          children,
        );
        row.append(details);
        details.addEventListener("toggle", () => {
          if (
            !details.isConnected ||
            details.open === expanded.has(instance.key)
          )
            return;
          if (details.open) expanded.add(instance.key);
          else expanded.delete(instance.key);
          const child = usage.instances.find(
            (item) =>
              item.owner.kind === "instance" &&
              item.owner.instanceKey === instance.key,
          );
          focusNested(details.open && child ? child.key : instance.key);
        });
      }
      list.append(row);
    }
    return list;
  };
  panel.append(build());
}
export function renderProps(
  panel: HTMLElement,
  data: WorkspaceData,
  selection: InspectorSelection,
): void {
  const doc = panel.ownerDocument;
  panel.replaceChildren();
  const props = selection.instance?.props ?? selection.props;
  if (!props) {
    panel.append(
      element(
        doc,
        "p",
        "Select a component instance to see its supplied props.",
      ),
    );
    return;
  }
  if (selection.instance) {
    const component = data.components.find(
      (item) => item.id === selection.instance!.componentId,
    );
    panel.append(
      element(
        doc,
        "h3",
        `${component?.title ?? selection.instance.componentId} · ${selection.instance.id}`,
      ),
    );
    if (component) {
      const link = element(doc, "a", "Open component");
      link.href = `/view/${component.route.split("/").map(encodeURIComponent).join("/")}`;
      panel.append(link);
    }
  }
  const values = decodeProps(props);
  const table = element(doc, "table");
  table.className = "mbk-props-table";
  table.setAttribute("aria-label", "Supplied props");
  for (const [name, value] of Object.entries(values)) {
    const row = element(doc, "tr");
    const header = element(doc, "th", name);
    header.scope = "row";
    const cell = element(doc, "td");
    cell.append(element(doc, "pre", propText(value)));
    row.append(header, cell);
    table.append(row);
  }
  panel.append(
    table.childElementCount
      ? table
      : element(doc, "p", "No data props supplied."),
  );
  const slots = selection.instance
    ? selection.usage?.slots
        .filter((slot) => slot.instanceKey === selection.instance!.key)
        .map(
          (slot) =>
            `${slot.name} · ${slot.owner.kind === "entry" ? "Supplied by this page" : "Supplied by a parent component"}`,
        )
    : selection.slots;
  if (slots?.length) {
    panel.append(element(doc, "h3", "Slots"));
    for (const slot of slots) panel.append(element(doc, "p", slot));
  }
}
