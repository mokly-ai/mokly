//! A consumer project with linked `node_modules` and authored files.

use tempfile::TempDir;

use crate::files::write;
use crate::publication::{link_node_modules, temporary_root};

/// Create a project with `mokly.config.json`, the workspace `node_modules`, and `files`.
///
/// A file in `files` named `mokly.config.json` replaces the empty configuration.
pub fn project(files: &[(&str, &str)]) -> TempDir {
    let root = tempfile::Builder::new()
        .prefix("mokly-js-serve-")
        .tempdir_in(temporary_root())
        .unwrap();
    link_node_modules(root.path());
    write(root.path(), "mokly.config.json", "{}");
    for (name, text) in files {
        write(root.path(), name, text);
    }
    root
}
