//! Historical conversion failures at a real source-tree boundary.

use std::collections::BTreeMap;
use std::path::Path;

use mokly_catalogue::working_tree::WorkingTree;
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::{Child, Node, SourceTree};

pub(super) struct Unavailable {
    pub(super) paths: BTreeMap<String, String>,
}

impl SourceTree for Unavailable {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        WorkingTree.project(path)
    }
    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        WorkingTree.children(path)
    }
    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        if let Some(message) = path
            .file_name()
            .and_then(|name| name.to_str())
            .and_then(|name| self.paths.get(name))
        {
            return Err(SourceError::Unavailable {
                path: path.into(),
                message: message.clone(),
            });
        }
        WorkingTree.read(path)
    }
}
