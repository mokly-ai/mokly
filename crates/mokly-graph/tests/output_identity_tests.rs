//! Working-tree and output identities share a spelling for private-tree exclusion.

use std::collections::BTreeMap;
use std::fs;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::policy::{FilePolicy, PublicPolicy};
use mokly_graph::public_denial::PublicDenial;
use mokly_source_interface::tree::SourceTree;
use tempfile::TempDir;

#[test]
fn the_projected_output_stays_private_under_the_loaded_repository_identity() {
    let temporary = TempDir::new().unwrap();
    fs::write(temporary.path().join("mokly.config.json"), "{}").unwrap();
    fs::create_dir(temporary.path().join("specs")).unwrap();
    fs::create_dir(temporary.path().join("site")).unwrap();
    fs::write(temporary.path().join("site/logo.svg"), "<svg/>").unwrap();
    let tree: Arc<dyn SourceTree> = Arc::new(WorkingTree);
    let config = Loader { tree: tree.clone() }
        .load(temporary.path(), None)
        .unwrap();
    let output = tree
        .project(&temporary.path().join("site"))
        .unwrap()
        .unwrap()
        .identity;
    let policy: &dyn PublicPolicy =
        &FilePolicy::new(tree, &config, &[], BTreeMap::new(), Some(&output)).unwrap();
    assert!(matches!(
        policy.check("site/logo.svg"),
        Err(PublicDenial::Private)
    ));
}
