//! Independent paired-view inputs without resource memo or parsed CSS access.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::match_tree::MatchTree;
use mokly_graph::cache::Artifact;
use mokly_graph::types::RenderGeneration;
use mokly_html::composition::Composed;

use crate::comparison_error::CompareResult;
use crate::comparison_resources::{self, Resources};
use crate::error::Result;
use crate::matching_tree;
use crate::view_material::{self, MaterialComparison};

/// Owned transient inputs, released after the ordered consumer finishes one view.
pub(crate) struct PreparedView {
    /// Base and head artifacts, with no borrowed document fields.
    pub(crate) artifacts: [Option<Arc<Artifact>>; 2],
    /// Validated closures with no relocation aliases yet.
    pub(crate) resources: Resources,
    /// Base and head root matching arenas.
    pub(crate) trees: [Option<MatchTree>; 2],
    /// Independent material for a paired view whose entry did not move.
    pub(crate) material: Option<MaterialComparison>,
}

/// Read a paired view through its checked generations without shared comparison caches.
pub(crate) trait ViewPreparation: Send + Sync {
    /// Preserve base document, head document, base closure, and head closure order.
    fn prepare(
        &self,
        before_route: Option<&str>,
        after_route: Option<&str>,
        moved: bool,
    ) -> Result<PreparedView>;
}

/// Generation dependencies and accepted path mappings for independent preparation.
pub(crate) struct Preparation<'a> {
    /// Checked base generation.
    pub(crate) before: &'a dyn RenderGeneration,
    /// Checked head generation.
    pub(crate) after: &'a dyn RenderGeneration,
    /// Accepted entry relocations, fixed before view preparation starts.
    pub(crate) paths: &'a BTreeMap<String, String>,
}

impl ViewPreparation for Preparation<'_> {
    fn prepare(
        &self,
        before_route: Option<&str>,
        after_route: Option<&str>,
        moved: bool,
    ) -> Result<PreparedView> {
        let before = before_route
            .map(|route| self.before.comparison_document(route).compare())
            .transpose()?;
        let after = after_route
            .map(|route| self.after.comparison_document(route).compare())
            .transpose()?;
        let artifacts = [before, after];
        let [before, after] = documents(&artifacts);
        let resources =
            comparison_resources::closures(self.before, self.after, before_route, after_route)?;
        let trees = [
            before.map(|document| matching_tree::document(&document.tree, self.paths)),
            after.map(|document| matching_tree::document(&document.tree, &BTreeMap::new())),
        ];
        let material = match (moved, before, after) {
            (false, Some(before), Some(after)) => Some(view_material::compare(
                before,
                after,
                &format!("static/mokly-generated/{}", before_route.unwrap_or("")),
                &format!("static/mokly-generated/{}", after_route.unwrap_or("")),
                self.paths,
                &BTreeMap::new(),
            )),
            _ => None,
        };
        Ok(PreparedView {
            artifacts,
            resources,
            trees,
            material,
        })
    }
}

/// Borrow composed documents while retaining their owning artifact handles.
pub(crate) fn documents(artifacts: &[Option<Arc<Artifact>>; 2]) -> [Option<&Composed>; 2] {
    [
        artifacts[0].as_ref().map(|artifact| {
            artifact
                .document
                .as_ref()
                .expect("the graph composes a document for every base comparison view plan")
        }),
        artifacts[1].as_ref().map(|artifact| {
            artifact
                .document
                .as_ref()
                .expect("the graph composes a document for every current comparison view plan")
        }),
    ]
}
