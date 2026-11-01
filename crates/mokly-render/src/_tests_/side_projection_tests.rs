//! Batched projection keeps repository, dependency, and alias selection identical.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::side::BaseSide;
use crate::sources::SideTree;

fn source_node(path: &Path) -> Result<Option<Node>> {
    if path == Path::new("/head/unavailable") {
        return Err(SourceError::Unavailable {
            path: path.into(),
            message: "metadata unavailable".into(),
        });
    }
    Ok([
        "/head/repo.svg",
        "/head/packages/pkg/icon.svg",
        "/head/components/work/icon.svg",
        "/head/private.svg",
    ]
    .iter()
    .any(|known| path == Path::new(known))
    .then(|| Node {
        identity: path.into(),
        kind: FileKind::File,
        lexical_kind: FileKind::File,
    }))
}

fn observation(
    result: Result<Option<Node>>,
) -> std::result::Result<Option<Node>, (PathBuf, String)> {
    match result {
        Ok(node) => Ok(node),
        Err(SourceError::Unavailable { path, message }) => Err((path, message)),
        Err(error) => panic!("unexpected projection error: {error}"),
    }
}

#[test]
fn side_projection_batch_matches_single_alias_and_dependency_selection() {
    let calls = Arc::new(AtomicUsize::new(0));
    let batched = calls.clone();
    let singles = Arc::new(AtomicUsize::new(0));
    let projected = singles.clone();
    let source = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                projected.fetch_add(1, Ordering::SeqCst);
                source_node(path)
            })),
        SourceTreeMock::project_batch
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, paths| {
                batched.fetch_add(1, Ordering::SeqCst);
                assert!(paths.contains(&PathBuf::from("/head/repo.svg")));
                assert!(paths.contains(&PathBuf::from("/head/packages/pkg/icon.svg")));
                assert!(paths.contains(&PathBuf::from("/head/components/work/icon.svg")));
                paths.iter().map(|path| source_node(path)).collect()
            })),
    ))
    .no_verify_in_drop();
    let dependencies = Unimock::new(SourceTreeMock::project.each_call(matching!(_)).answers(
        &|_, path| {
            let identity = match path {
                path if path == Path::new("/deps/node_modules/work/icon.svg") => {
                    PathBuf::from("/checkout/components/work/icon.svg")
                }
                path if path == Path::new("/second/other/icon.svg")
                    || path == Path::new("/second") =>
                {
                    path.into()
                }
                _ => return Ok(None),
            };
            Ok(Some(Node {
                identity,
                kind: if path == Path::new("/second") {
                    FileKind::Directory
                } else {
                    FileKind::File
                },
                lexical_kind: FileKind::File,
            }))
        },
    ));
    let tree = SideTree {
        _base: Some(Arc::new(BaseSide {
            sources: Arc::new(Lease {
                directory: "/base".into(),
                guard: Box::new(Unimock::new(())),
            }),
            dependencies: Resolved {
                tier: Tier::Installed,
                node_modules: "/deps/node_modules".into(),
                module_resolution: Default::default(),
                warning: None,
                lease: None,
                repository_roots: Vec::new(),
            },
            identity: "base".into(),
        })),
        sources: Arc::new(source),
        dependencies: Arc::new(dependencies),
        usage: Arc::new(Unimock::new(())),
        aliases: [("packages/pkg".into(), "node_modules/pkg".into())].into(),
        root: "/head".into(),
        dependency_roots: vec!["/deps/node_modules".into(), "/second".into()],
        repository_roots: vec!["/checkout".into()],
    };
    let paths: Vec<PathBuf> = [
        "/head/repo.svg",
        "/head/node_modules/pkg/icon.svg",
        "/head/node_modules/work/icon.svg",
        "/head/node_modules/.mokly-roots/1/other/icon.svg",
        "/head/node_modules/.mokly-roots/source/private.svg",
        "/head/missing.svg",
        "/head/unavailable",
    ]
    .into_iter()
    .map(PathBuf::from)
    .collect();
    let expected: Vec<_> = paths
        .iter()
        .map(|path| observation(tree.project(path)))
        .collect();
    singles.store(0, Ordering::SeqCst);
    let results = tree.project_batch(&paths);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(singles.load(Ordering::SeqCst), 0);
    assert_eq!(
        results.into_iter().map(observation).collect::<Vec<_>>(),
        expected
    );
}
