// The rows of the served catalogue tree. Collection groups are native
// `<details>` elements rendered here; leaves, their glyphs and the variant
// list a screen discloses live in `nav_leaf_rows.tsx`.

import type { ShellContext } from "./context.js";
import { FolderIcon, FolderOpenIcon } from "./icons.js";
import { navRowStyle } from "./nav_guides.js";
import { containsRoute, LeafRow } from "./nav_leaf_rows.js";
import type { NavGroupNode, NavNode, NavSectionNode } from "./nav_tree.js";

/** The persisted disclosure identity of one projected collection group. */
function collectionDisclosureKey(
  sectionId: NavSectionNode["id"],
  collectionKey: string,
): string {
  const id = collectionKey.startsWith("collection:")
    ? collectionKey.slice("collection:".length)
    : collectionKey;
  return `collection:${sectionId}:${id}`;
}

/** One authored collection projected into a section as a native disclosure. */
function GroupRow(props: {
  context: ShellContext;
  depth: number;
  node: NavGroupNode;
  sectionId: NavSectionNode["id"];
}) {
  const node = props.node;
  const open =
    props.depth === 0 || containsRoute(node, props.context.activeRoute);
  return (
    <details
      className="mbk-nav-group"
      data-nav-collection={node.key}
      data-nav-disclosure={collectionDisclosureKey(props.sectionId, node.key)}
      open={open ? true : undefined}
    >
      <summary className="mbk-nav-row" style={navRowStyle(props.depth)}>
        <span className="mbk-nav-ico folder">
          <FolderIcon />
          <FolderOpenIcon />
        </span>
        <span className="mbk-nav-label">{node.label}</span>
        {node.children.length > 0 ? (
          <span className="mbk-nav-count">{node.children.length}</span>
        ) : null}
      </summary>
      <NavRows
        context={props.context}
        depth={props.depth + 1}
        nodes={node.children}
        sectionId={props.sectionId}
      />
    </details>
  );
}

/** Every row at one depth of a section's projected hierarchy. */
export function NavRows(props: {
  context: ShellContext;
  depth: number;
  nodes: readonly NavNode[];
  sectionId: NavSectionNode["id"];
}) {
  return (
    <>
      {props.nodes.map((node) => {
        return node.kind === "group" ? (
          <GroupRow
            context={props.context}
            depth={props.depth}
            key={node.key}
            node={node}
            sectionId={props.sectionId}
          />
        ) : (
          <LeafRow
            context={props.context}
            depth={props.depth}
            key={node.key}
            node={node}
            sectionId={props.sectionId}
          />
        );
      })}
    </>
  );
}
