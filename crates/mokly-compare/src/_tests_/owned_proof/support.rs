//! Pure composed documents and exact instance selection for owned CSS changes.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::attribution::{self, OwnPageMatches, PageObservation};
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_html::composition::Composed;
use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};
use unimock::Unimock;

use crate::owned_styles::{self, Changes};
use crate::resource_memo::Memo;
use crate::{matching_tree, view_material};

#[derive(Debug, PartialEq)]
pub(super) struct Proof {
    component: String,
    instance: String,
}

pub(super) fn record((component, instance): (String, String)) -> Proof {
    Proof {
        component,
        instance,
    }
}

pub(super) fn expected(component: &str, instance: &str) -> Proof {
    Proof {
        component: component.into(),
        instance: instance.into(),
    }
}

pub(super) fn instance(path: &str, key: &str, children: Vec<Node>) -> Node {
    instance_with_props(path, key, "props", children)
}

pub(super) fn instance_with_props(path: &str, key: &str, props: &str, children: Vec<Node>) -> Node {
    Node::Region {
        region: Region {
            id: key.into(),
            kind: RegionKind::Instance {
                path: path.into(),
                key: key.into(),
                local_id: key.into(),
                props_key: props.into(),
            },
        },
        children,
    }
}

pub(super) fn slot(receiver: &str, supplier: ComponentInputOwner, children: Vec<Node>) -> Node {
    Node::Region {
        region: Region {
            id: "slot".into(),
            kind: RegionKind::Slot {
                key: "slot".into(),
                instance_key: receiver.into(),
                name: "children".into(),
                owner: supplier,
            },
        },
        children,
    }
}

pub(super) fn hit() -> Node {
    tree::element("b", &[("class", "hit")], vec![])
}

pub(super) fn document(mut nodes: Vec<Node>, color: &str, owner: &str) -> Composed {
    let mut style = tree::element(
        "style",
        &[],
        vec![Node::Text(format!(".hit{{color:{color}}}"))],
    );
    if let Node::Element(style) = &mut style {
        style.style_owners = Some(vec![owner.into()]);
    }
    nodes.push(style);
    Composed {
        tree: nodes,
        usage: CatalogueUsage::Unavailable,
        warnings: vec![],
        resources: vec![],
        components: vec![],
        links: vec![],
    }
}

pub(super) fn compare(
    before: &Composed,
    after: &Composed,
    paths: &BTreeMap<String, String>,
) -> Changes {
    compare_views(Some(before), Some(after), paths)
}

pub(super) fn compare_views(
    before: Option<&Composed>,
    after: Option<&Composed>,
    paths: &BTreeMap<String, String>,
) -> Changes {
    let generation = Arc::new(Unimock::new(()));
    let memo = Memo::new(
        generation.clone(),
        generation,
        Arc::new(MemoryParsedCss::new(4096)),
        4096,
    );
    let before_nodes = before.map_or(&[][..], |document| document.tree.as_slice());
    let after_nodes = after.map_or(&[][..], |document| document.tree.as_slice());
    let before_tree = before.map(|document| matching_tree::document(&document.tree, paths));
    let after_tree =
        after.map(|document| matching_tree::document(&document.tree, &BTreeMap::new()));
    let comparison = match (before, after) {
        (Some(before), Some(after)) => Some(view_material::compare(
            before,
            after,
            "before.html",
            "after.html",
            paths,
            &BTreeMap::new(),
        )),
        _ => None,
    };
    let mut changes = owned_styles::compare(
        [before_nodes, after_nodes],
        [before_tree.as_ref(), after_tree.as_ref()],
        paths,
        "document.html",
        &memo,
        comparison
            .as_ref()
            .map_or(&[], |comparison| comparison.instances.as_slice()),
    )
    .unwrap();
    if let Some(comparison) = comparison {
        changes.prepare(&comparison);
    }
    changes
}

pub(super) fn own_pages(path: &str) -> OwnPageMatches {
    let nodes = || {
        vec![Node::Region {
            region: Region {
                id: "root".into(),
                kind: RegionKind::Root { path: path.into() },
            },
            children: vec![hit()],
        }]
    };
    let changes = compare(
        &document(nodes(), "red", path),
        &document(nodes(), "blue", path),
        &BTreeMap::new(),
    );
    attribution::attribute(vec![PageObservation {
        component: Some(path.into()),
        rules: changes.rules,
    }])
    .own_pages
}
