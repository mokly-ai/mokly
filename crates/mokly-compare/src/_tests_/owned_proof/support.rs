//! Pure composed documents and full proof records for owned CSS changes.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_html::composition::Composed;
use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::{EntryContent, ModelEntry, VisualEntry};
use mokly_model::review::{EntryChangeReason, ReviewEntryAddress};
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};
use serde_json::json;
use unimock::Unimock;

use crate::comparison_address::address;
use crate::comparison_types::ViewKey;
use crate::instance_proof::InstanceProof;
use crate::owned_styles::{self, Changes};
use crate::resource_memo::Memo;
use crate::{matching_tree, view_material};

pub(super) const VIEW: ViewKey = ViewKey {
    viewport: Some(Viewport::Desktop),
    color_scheme: ColorScheme::Dark,
};

#[derive(Debug, PartialEq)]
pub(super) struct Proof {
    component: String,
    instance: String,
    before: ReviewEntryAddress,
    after: ReviewEntryAddress,
    view: ViewKey,
    reason: EntryChangeReason,
}

pub(super) fn record(proof: InstanceProof) -> Proof {
    assert!(proof.reference.is_none());
    Proof {
        component: proof.component,
        instance: proof.instance,
        before: proof.before,
        after: proof.after,
        view: proof.view,
        reason: proof.reason,
    }
}

pub(super) fn expected(component: &str, instance: &str) -> Proof {
    Proof {
        component: component.into(),
        instance: instance.into(),
        before: address(&entry("before")),
        after: address(&entry("after")),
        view: VIEW,
        reason: EntryChangeReason::Implementation,
    }
}

pub(super) fn instance(path: &str, key: &str, children: Vec<Node>) -> Node {
    Node::Region {
        region: Region {
            id: key.into(),
            kind: RegionKind::Instance {
                path: path.into(),
                key: key.into(),
                local_id: key.into(),
                props_key: "props".into(),
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
    let generation = Arc::new(Unimock::new(()));
    let memo = Memo::new(
        generation.clone(),
        generation,
        Arc::new(MemoryParsedCss::new(4096)),
        4096,
    );
    let before_tree = matching_tree::document(&before.tree, paths);
    let after_tree = matching_tree::document(&after.tree, &BTreeMap::new());
    let mut changes = owned_styles::compare(
        [&before.tree, &after.tree],
        [Some(&before_tree), Some(&after_tree)],
        paths,
        "document.html",
        &memo,
    )
    .unwrap();
    let comparison = view_material::compare(
        before,
        after,
        "before.html",
        "after.html",
        paths,
        &BTreeMap::new(),
    );
    changes.prepare(&comparison, &entry("before"), &entry("after"), VIEW);
    changes
}

fn entry(path: &str) -> ModelEntry {
    ModelEntry {
        metadata: serde_json::from_value(json!({
            "path": path, "title": format!("Title {path}"), "description": "",
            "tags": [], "relatedDocs": [], "isIndex": false,
            "source": {"path": "specs/input.html", "line": 1, "column": 1},
            "rootIndex": 0
        }))
        .unwrap(),
        content: EntryContent::Component {
            visual: VisualEntry {
                color_schemes: vec![ColorScheme::Dark],
                prop_schema: Default::default(),
                props: serde_json::from_value(json!({
                    "payload": "x".repeat(16_384), "nested": {"side": path, "items": [1, true]}
                }))
                .unwrap(),
                controls: BTreeMap::new(),
                control_order: vec![],
            },
            element: None,
            slots: vec!["children".into()],
            supplied_slots: vec!["children".into()],
        },
    }
}
