import { mockLink } from "@mokly/mokly";

import {
  InstanceTree,
  type InstanceNode,
} from "../../../../../../packages/ui/src/instance-tree/instance-tree.js";
import {
  UsageList,
  type UsageRow,
} from "../../../../../../packages/ui/src/usage-list/usage-list.js";
import { COMPONENTS } from "../../components/parts/metadata.js";

import { CANVAS_PAGES, type CanvasDestination } from "./destinations.js";
import {
  DETAILS_INSTANCES,
  TOOLBAR_INSTANCES,
  WELCOME_INSTANCES,
} from "./instance_records.js";
import type { CanvasInstance, InstanceRecords } from "./instances.js";

/**
 * The Usage section of a screen in the shipped list: a screen has no
 * recorded consumer, as its Usage tab says today.
 */
export function ScreenUsage() {
  return <UsageList affected={[]} usedBy={[]} />;
}

/** The views of a consumer that renders in both viewports and schemes. */
const CONSUMER_VIEWS = 4;

/** The number of an entry's instances of one component, by its records. */
function instancesOf(
  records: Readonly<Record<string, CanvasInstance>>,
  component: string,
): number {
  return Object.values(records).filter(
    (instance) => instance.component === component,
  ).length;
}

/** A consumer that uses a component itself, and the artboard that opens it. */
function consumer(
  title: string,
  to: CanvasDestination,
  instances: number,
): UsageRow {
  return {
    direct: true,
    href: mockLink(to),
    id: title,
    instances,
    key: title,
    removed: false,
    title,
    views: CONSUMER_VIEWS,
  };
}

/** The screens that render a component, each opening its Canvas artboard. */
function screenConsumers(component: string): UsageRow[] {
  return [
    consumer(
      "Welcome",
      CANVAS_PAGES.overview,
      instancesOf(WELCOME_INSTANCES, component),
    ),
    consumer(
      "Details",
      CANVAS_PAGES.added,
      instancesOf(DETAILS_INSTANCES, component),
    ),
  ];
}

/**
 * The Usage section of the Action in the shipped list: the entries that use
 * it, each opening its Canvas artboard. Welcome and Details render an Action
 * and a Toolbar with two Actions, and the Toolbar renders its two Actions.
 */
export function ActionUsage() {
  const action = COMPONENTS.action.title;
  return (
    <UsageList
      affected={[]}
      usedBy={[
        ...screenConsumers(action),
        consumer(
          COMPONENTS.toolbar.title,
          CANVAS_PAGES.componentSetToolbar,
          instancesOf(TOOLBAR_INSTANCES, action),
        ),
      ]}
    />
  );
}

/** The Usage section of the Toolbar: Welcome and Details render one each. */
export function ToolbarUsage() {
  return (
    <UsageList
      affected={[]}
      usedBy={screenConsumers(COMPONENTS.toolbar.title)}
    />
  );
}

/**
 * An entry's instances under one owner, by their records' order. Each links
 * to the artboard that shows it selected; the selected instance links to the
 * artboard that renders the tree.
 */
function instanceNodes(
  records: Readonly<Record<string, CanvasInstance>>,
  owner: string | undefined,
  selected: string | undefined,
  design: CanvasDestination | undefined,
): InstanceNode[] {
  return Object.values(records)
    .filter((instance) => instance.parent === owner)
    .map((instance) => ({
      href: mockLink(
        instance.id === selected && design !== undefined
          ? design
          : instance.page,
      ),
      id: instance.id,
      key: instance.id,
      nested: instanceNodes(records, instance.id, selected, design),
      title: instance.component,
    }));
}

/**
 * The component tree of an entry in the shipped tree: a screen's
 * Components, or a composed component's nested components. A nested list
 * starts open where one of its instances is selected, or where the section
 * shows the whole tree.
 */
export function InstanceComponents<Id extends string>({
  design,
  expanded,
  records,
  selected,
}: {
  /** The artboard that renders the tree, which the selected row opens. */
  design?: CanvasDestination | undefined;
  /** Every nested list starts open. */
  expanded?: boolean | undefined;
  records: InstanceRecords<Id>;
  selected?: Id | undefined;
}) {
  const instances: readonly CanvasInstance[] = Object.values(records);
  const owners = instances
    .filter((owner) => instances.some((nested) => nested.parent === owner.id))
    .map((owner) => owner.id);
  const parent = selected === undefined ? undefined : records[selected].parent;
  return (
    <InstanceTree
      initiallyExpanded={
        expanded ? owners : parent === undefined ? [] : [parent]
      }
      selectedKey={selected}
      usage={{
        status: "ready",
        components: new Set(instances.map((instance) => instance.component))
          .size,
        instances: instanceNodes(records, undefined, selected, design),
        total: instances.length,
      }}
      viewport="mobile"
      viewports={[]}
    />
  );
}

/** The Components section of an entry that renders no registered component. */
export function NoComponents() {
  return (
    <InstanceTree
      usage={{ status: "ready", components: 0, instances: [], total: 0 }}
      viewport="desktop"
      viewports={[]}
    />
  );
}
