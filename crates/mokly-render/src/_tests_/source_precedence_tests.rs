//! Tracked dependency bytes and installed lookup metadata keep separate source boundaries.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::dependency_usage::DependencyUsageMock;
use crate::side::{BaseSide, SideInputs};
use crate::source_paths::INSTALLED_INPUT_PREFIX;
use crate::sources::SideTree;

fn aliases() -> BTreeMap<String, String> {
    BTreeMap::from([
        ("app/node_modules".into(), "node_modules".into()),
        ("node_modules".into(), "node_modules/.mokly-roots/1".into()),
    ])
}

fn tree(sources: Unimock, dependencies: Unimock, usage: Unimock) -> SideTree {
    SideTree {
        _base: Some(Arc::new(BaseSide {
            sources: Lease {
                directory: "/base".into(),
                guard: Box::new(Unimock::new(())),
            },
            dependencies: Resolved {
                tier: Tier::Working,
                node_modules: "/deps/node_modules".into(),
                module_resolution: Default::default(),
                warning: None,
                lease: None,
                repository_roots: vec![],
            },
            identity: "base".into(),
        })),
        sources: Arc::new(sources),
        dependencies: Arc::new(dependencies),
        usage: Arc::new(usage),
        aliases: aliases(),
        root: "/repo".into(),
        dependency_roots: vec!["/deps/app/node_modules".into(), "/deps/node_modules".into()],
        repository_roots: vec![],
    }
}

fn node(path: &Path, kind: FileKind) -> Node {
    Node {
        identity: path.into(),
        lexical_kind: kind,
        kind,
    }
}

#[test]
fn every_read_uses_the_tracked_source_behind_a_selected_dependency_alias() {
    let mock = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                assert!(
                    [
                        Path::new("/repo/node_modules/theme/skin.css"),
                        Path::new("/repo/node_modules/theme")
                    ]
                    .contains(&path)
                );
                Ok(Some(node(
                    path,
                    if path.extension().is_some() {
                        FileKind::File
                    } else {
                        FileKind::Directory
                    },
                )))
            })
            .n_times(7),
        SourceTreeMock::read
            .next_call(matching!((path) if *path == Path::new("/repo/node_modules/theme/skin.css")))
            .returns(Ok(b"base".to_vec())),
        SourceTreeMock::read_public
            .next_call(matching!((path) if *path == Path::new("/repo/node_modules/theme/skin.css")))
            .returns(Ok(b"public".to_vec())),
        SourceTreeMock::read_shared
            .next_call(matching!((path) if *path == Path::new("/repo/node_modules/theme/skin.css")))
            .returns(Ok(Arc::<[u8]>::from(b"shared".as_slice()))),
        SourceTreeMock::digest
            .next_call(matching!((path) if *path == Path::new("/repo/node_modules/theme/skin.css")))
            .returns(Ok("base digest".into())),
        SourceTreeMock::prefetch
            .next_call(matching!((paths) if paths == &[PathBuf::from("/repo/node_modules/theme/skin.css")]))
            .returns(Ok(())),
        SourceTreeMock::children
            .next_call(matching!((path) if *path == Path::new("/repo/node_modules/theme")))
            .returns(Ok(vec![])),
    ));
    let usage = Unimock::new(
        DependencyUsageMock::record
            .each_call(matching!(_, "node_modules/.mokly-roots/1/theme/skin.css"))
            .returns(())
            .n_times(4),
    );
    let tree: &dyn SourceTree = &tree(mock, Unimock::new(()), usage);
    let logical = Path::new("/repo/node_modules/.mokly-roots/1/theme/skin.css");
    assert_eq!(tree.project(logical).unwrap().unwrap().identity, logical);
    assert_eq!(tree.read(logical).unwrap(), b"base");
    assert_eq!(tree.read_public(logical).unwrap(), b"public");
    assert_eq!(tree.read_shared(logical).unwrap().as_ref(), b"shared");
    assert_eq!(tree.digest(logical).unwrap(), "base digest");
    tree.prefetch(&[logical.into()]).unwrap();
    assert!(
        tree.children(Path::new("/repo/node_modules/.mokly-roots/1/theme"))
            .unwrap()
            .is_empty()
    );
}

#[test]
fn installation_membership_is_not_shadowed_by_a_tracked_source_directory() {
    let dependencies = Unimock::new((
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/deps/src/node_modules")))
            .returns(Ok(Some(node(
                Path::new("/deps/src/node_modules"),
                FileKind::Directory,
            )))),
        SourceTreeMock::children
            .next_call(matching!((path) if *path == Path::new("/deps/src/node_modules")))
            .returns(Ok(vec![Child {
                name: "new-package.js".into(),
                kind: FileKind::File,
            }])),
    ));
    let tree: &dyn SourceTree = &tree(Unimock::new(()), dependencies, Unimock::new(()));
    let path = PathBuf::from("/repo").join(format!("{INSTALLED_INPUT_PREFIX}src/node_modules"));
    assert_eq!(tree.children(&path).unwrap()[0].name, "new-package.js");
}

#[test]
fn postcss_source_paths_use_the_extracted_tracked_file() {
    let source = Unimock::new(
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/repo/node_modules/theme/skin.css")))
            .returns(Ok(Some(node(
                Path::new("/repo/node_modules/theme/skin.css"),
                FileKind::File,
            )))),
    );
    let side = SideInputs {
        source_root: "/base".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        configuration_directory: "app".into(),
        context: "base".into(),
        dependency_aliases: aliases(),
        dependency_roots: vec!["/deps/app/node_modules".into(), "/deps/node_modules".into()],
    };
    assert_eq!(
        side.physical_source(
            "node_modules/.mokly-roots/1/theme/skin.css",
            &source,
            Path::new("/repo")
        )
        .unwrap(),
        Path::new("/base/node_modules/theme/skin.css")
    );
}
