import { mockLink } from "@mokly/mokly";

import {
  InstanceTree,
  type InstanceNode,
} from "../../../../../../packages/ui/src/instance-tree/instance-tree.js";
import {
  UsageList,
  type UsageRow,
} from "../../../../../../packages/ui/src/usage-list/usage-list.js";

import { CANVAS_PAGES, type CanvasDestination } from "./destinations.js";
import {
  WELCOME_INSTANCES,
  type WelcomeInstanceId,
} from "./welcome_instances.js";

/**
 * The Usage section of a screen in the shipped list: a screen has no
 * recorded consumer, as its Usage tab says today.
 */
export function ScreenUsage() {
  return <UsageList affected={[]} usedBy={[]} />;
}

/** The views of a consumer that renders in both viewports and schemes. */
const CONSUMER_VIEWS = 4;

/**
 * The Actions that Welcome renders, its own and the Toolbar's two. Details
 * renders as many: its own Action and the two of its Toolbar.
 */
const WELCOME_ACTIONS = Object.values(WELCOME_INSTANCES).filter(
  (instance) => instance.component === "Action",
).length;

/** A screen that uses the Action itself, and the artboard that opens it. */
function actionConsumer(title: string, to: CanvasDestination): UsageRow {
  return {
    direct: true,
    href: mockLink(to),
    id: title,
    instances: WELCOME_ACTIONS,
    key: title,
    removed: false,
    title,
    views: CONSUMER_VIEWS,
  };
}

/**
 * The Usage section of the Action in the shipped list: the screens that
 * use it, each opening its Canvas artboard, Welcome and Details.
 */
export function ActionUsage() {
  return (
    <UsageList
      affected={[]}
      usedBy={[
        actionConsumer("Welcome", CANVAS_PAGES.overview),
        actionConsumer("Details", CANVAS_PAGES.added),
      ]}
    />
  );
}

/**
 * Welcome's instances under one owner, by their records' order. Each links
 * to the artboard that shows it selected; the selected instance links to the
 * artboard that renders the tree.
 */
function welcomeNodes(
  owner: WelcomeInstanceId | undefined,
  selected: WelcomeInstanceId | undefined,
  design: CanvasDestination | undefined,
): InstanceNode[] {
  return Object.values(WELCOME_INSTANCES)
    .filter((instance) => instance.parent === owner)
    .map((instance) => ({
      href: mockLink(
        instance.id === selected && design !== undefined
          ? design
          : instance.page,
      ),
      id: instance.id,
      key: instance.id,
      nested: welcomeNodes(instance.id, selected, design),
      title: instance.component,
    }));
}

/**
 * The Components section of Welcome in the shipped tree: its Action and its
 * Toolbar, and the Toolbar's two Actions in a nested list, which starts open
 * where one of them is selected or where the section shows the whole tree.
 */
export function WelcomeComponents({
  design,
  expanded,
  selected,
}: {
  /** The artboard that renders the tree, which the selected row opens. */
  design?: CanvasDestination | undefined;
  /** The Toolbar's nested list starts open. */
  expanded?: boolean | undefined;
  selected?: WelcomeInstanceId | undefined;
}) {
  const instances = Object.values(WELCOME_INSTANCES);
  const parent =
    selected === undefined ? undefined : WELCOME_INSTANCES[selected].parent;
  return (
    <InstanceTree
      initiallyExpanded={
        expanded || parent !== undefined ? [parent ?? "toolbar"] : []
      }
      selectedKey={selected}
      usage={{
        status: "ready",
        components: new Set(instances.map((instance) => instance.component))
          .size,
        instances: welcomeNodes(undefined, selected, design),
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
