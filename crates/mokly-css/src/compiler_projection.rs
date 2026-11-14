//! Collect metadata without raising an error before authored reference order.

use std::collections::BTreeSet;
use std::path::Path;

use mokly_source_interface::tree::Node;

use crate::compiler::Preparation;
use crate::{paths, syntax};

impl Preparation<'_> {
    pub(crate) fn project_asset_targets(&mut self, stylesheet: &str, text: &str) {
        let requested: BTreeSet<_> = syntax::references(text)
            .into_iter()
            .filter(|reference| {
                !reference.import
                    && !reference.image_set_string
                    && !paths::external(&reference.value)
                    && !reference.value.starts_with('/')
            })
            .filter_map(|reference| {
                let path = reference
                    .value
                    .find(['?', '#'])
                    .map_or(reference.value.as_str(), |index| &reference.value[..index]);
                paths::resolve(stylesheet, path)
            })
            .filter(|target| {
                paths::content_type(target).is_some()
                    && paths::portable(target, true)
                    && !self.result.assets.contains_key(&format!("assets/{target}"))
            })
            .map(|target| self.compiler.repo_root.join(target))
            .collect();
        let requested: Vec<_> = requested.into_iter().collect();
        if requested.is_empty() {
            return;
        }
        for (path, result) in requested
            .iter()
            .cloned()
            .zip(self.compiler.tree.project_batch(&requested))
        {
            self.asset_nodes.entry(path).or_insert(result);
        }
    }

    pub(crate) fn projected_node(&self, path: &Path) -> Option<Node> {
        match self.asset_nodes.get(path) {
            Some(result) => result.as_ref().ok().cloned().flatten(),
            None => self.compiler.tree.project(path).ok().flatten(),
        }
    }
}
