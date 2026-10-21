//! A plugin's repository alias must not select an unrelated package installation.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::tree::{FileKind, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::source_paths::SOURCE_INPUT_PREFIX;
use crate::sources::SideTree;

#[test]
fn repository_witnesses_bypass_dependency_root_aliases() {
    let tree = SideTree {
        _base:None, root:"/repo".into(), dependency_roots:vec!["/repo/app/node_modules".into()],
        repository_roots:vec!["/repo".into()], aliases:BTreeMap::new(),
        sources:Arc::new(Unimock::new(SourceTreeMock::observe_inputs.next_call(matching!((path, _) if *path == Path::new("/repo/node_modules/workspace/tokens.txt"))).returns(Ok(())))),
        dependencies:Arc::new(Unimock::new(())),usage:Arc::new(Unimock::new(())),
    };
    tree.observe_input(
        &Path::new("/repo").join(format!(
            "{SOURCE_INPUT_PREFIX}node_modules/workspace/tokens.txt"
        )),
        &ReadBaseline::ObservedWholeFile("old".into()),
    )
    .unwrap();
}

#[test]
fn secondary_package_roots_keep_a_virtual_parent_without_a_primary_installation() {
    let tree = SideTree {
        _base: None,
        root: "/repo".into(),
        dependency_roots: vec!["/repo/node_modules".into(), "/repo/app/node_modules".into()],
        repository_roots: vec!["/repo".into()],
        aliases: BTreeMap::new(),
        sources: Arc::new(Unimock::new(())),
        dependencies: Arc::new(Unimock::new(())),
        usage: Arc::new(Unimock::new(())),
    };
    for path in ["/repo/node_modules", "/repo/node_modules/.mokly-roots"] {
        let node = tree.project(Path::new(path)).unwrap().unwrap();
        assert_eq!(node.kind, FileKind::Directory);
        assert_eq!(node.identity, Path::new(path));
    }
}
