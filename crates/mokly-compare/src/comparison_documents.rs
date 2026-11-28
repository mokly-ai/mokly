//! Build matching and material inputs once after exact codec equality is proved.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::cache::Artifact;

use crate::comparison_preparation::{PreparedView, documents};
use crate::comparison_resources::Resources;
use crate::instance_policy::{self, Transparency};
use crate::{equal_material, matching_tree, view_material};

pub(crate) fn prepare(
    artifacts: [Option<Arc<Artifact>>; 2],
    resources: Resources,
    routes: [Option<&str>; 2],
    paths: &BTreeMap<String, String>,
    moved: bool,
    equal_document: bool,
    transparent: &Transparency,
) -> PreparedView {
    let [before, after] = documents(&artifacts);
    let trees = if equal_document {
        let tree = after
            .map(|document| Arc::new(matching_tree::document(&document.tree, &BTreeMap::new())));
        [tree.clone(), tree]
    } else {
        [
            before.map(|document| Arc::new(matching_tree::document(&document.tree, paths))),
            after.map(|document| {
                Arc::new(matching_tree::document(&document.tree, &BTreeMap::new()))
            }),
        ]
    };
    let material = match (moved, before, after) {
        (false, Some(_), Some(document))
            if equal_document && instance_policy::same_for(&document.tree, transparent) =>
        {
            Some(equal_material::compare(document))
        }
        (false, Some(before), Some(after)) => Some(view_material::compare(
            before,
            after,
            &format!("static/mokly-generated/{}", routes[0].unwrap_or("")),
            &format!("static/mokly-generated/{}", routes[1].unwrap_or("")),
            paths,
            &BTreeMap::new(),
            transparent,
        )),
        _ => None,
    };
    PreparedView {
        recorder: None,
        artifacts,
        resources,
        trees,
        material,
        equal_document,
    }
}
