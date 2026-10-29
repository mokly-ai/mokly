//! Every side-tree read keeps its dependency mapping and digest-only boundary.

use std::path::Path;
use std::sync::Arc;

use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};

use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::dependency_usage::DependencyUsageMock;
use crate::side::BaseSide;
use crate::sources::SideTree;

#[test]
fn mapped_public_hashes_bytes_shared_reads_and_prefetch_reach_the_dependency_tree() {
    let dependencies = Unimock::new((
        SourceTreeMock::project.each_call(matching!((path) if *path == Path::new("/deps/node_modules/theme/skin.css"))).answers(&|_, _| Ok(None)).n_times(5),
        SourceTreeMock::digest.next_call(matching!((path) if *path == Path::new("/deps/node_modules/theme/skin.css"))).returns(Ok("hash".into())),
        SourceTreeMock::read_public.next_call(matching!((path) if *path == Path::new("/deps/node_modules/theme/skin.css"))).returns(Ok(b"public".to_vec())),
        SourceTreeMock::read_shared.next_call(matching!((path) if *path == Path::new("/deps/node_modules/theme/skin.css"))).returns(Ok(Arc::<[u8]>::from(b"shared".as_slice()))),
        SourceTreeMock::prefetch.next_call(matching!((paths) if paths == &[Path::new("/deps/node_modules/theme/skin.css").to_owned()])).returns(Ok(())),
        SourceTreeMock::children.next_call(matching!((path) if *path == Path::new("/deps/node_modules/theme/skin.css"))).returns(Ok(vec![])),
    ));
    let tree: &dyn SourceTree = &SideTree {
        _base: None,
        sources: Arc::new(Unimock::new(
            SourceTreeMock::prefetch
                .next_call(
                    matching!((paths) if paths == &[Path::new("/repo/source.js").to_owned()]),
                )
                .returns(Ok(())),
        )),
        dependencies: Arc::new(dependencies),
        usage: Arc::new(Unimock::new(
            DependencyUsageMock::record
                .each_call(matching!(_, "node_modules/theme/skin.css"))
                .returns(())
                .n_times(3),
        )),
        aliases: Default::default(),
        root: "/repo".into(),
        dependency_roots: vec!["/deps/node_modules".into()],
        repository_roots: vec![],
    };
    let path = Path::new("/repo/node_modules/theme/skin.css");
    assert_eq!(tree.digest(path).unwrap(), "hash");
    assert_eq!(tree.read_public(path).unwrap(), b"public");
    assert_eq!(tree.read_shared(path).unwrap().as_ref(), b"shared");
    tree.prefetch(&[path.into(), "/repo/source.js".into()])
        .unwrap();
    assert!(tree.children(path).unwrap().is_empty());
}

#[test]
fn nested_dependency_hashes_and_prefetch_use_the_selected_base_installation() {
    let physical = Path::new("/deps/packages/ui/node_modules/theme.css");
    let dependency = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                assert_eq!(path, Path::new("/deps/packages/ui/node_modules/theme.css"));
                Ok(None)
            })
            .n_times(2),
        SourceTreeMock::digest
            .next_call(matching!(_))
            .answers(&|_, path| {
                assert_eq!(path, Path::new("/deps/packages/ui/node_modules/theme.css"));
                Ok("base hash".into())
            }),
        SourceTreeMock::prefetch
            .next_call(matching!(_))
            .answers(&|_, paths| {
                assert_eq!(
                    paths,
                    [Path::new("/deps/packages/ui/node_modules/theme.css")]
                );
                Ok(())
            }),
    ));
    let tree: &dyn SourceTree = &SideTree {
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
                repository_roots: vec![],
            },
            identity: "base".into(),
        })),
        sources: Arc::new(Unimock::new(SourceTreeMock::project.each_call(matching!((path) if *path == Path::new("/head/packages/ui/node_modules/theme.css"))).answers(&|_, _| Ok(None)).n_times(2))),
        dependencies: Arc::new(dependency),
        usage: Arc::new(Unimock::new(
            DependencyUsageMock::record
                .next_call(matching!(_, "packages/ui/node_modules/theme.css"))
                .returns(()),
        )),
        aliases: Default::default(),
        root: "/head".into(),
        dependency_roots: vec![],
        repository_roots: vec![],
    };
    let logical = Path::new("/head/packages/ui/node_modules/theme.css");
    assert_ne!(logical, physical);
    assert_eq!(tree.digest(logical).unwrap(), "base hash");
    tree.prefetch(&[logical.into()]).unwrap();
}

#[test]
fn opaque_digest_batches_group_by_selected_tree_and_keep_the_request_order() {
    let sources = Unimock::new((
        SourceTreeMock::digest_unretained_batch
            .next_call(matching!((paths) if paths == &[
                Path::new("/repo/a.svg").to_owned(), Path::new("/repo/c.svg").to_owned(),
            ]))
            .returns(vec![Ok("a".into()), Ok("c".into())]),
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    kind: FileKind::File,
                    lexical_kind: FileKind::File,
                }))
            })
            .n_times(2),
    ));
    let dependencies = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!((path) if *path == Path::new("/deps/node_modules/pkg/b.svg")))
            .answers(&|_, _| Ok(None))
            .n_times(2),
        SourceTreeMock::digest_unretained_batch
            .next_call(matching!((paths) if paths == &[
                Path::new("/deps/node_modules/pkg/b.svg").to_owned(),
            ]))
            .returns(vec![Ok("b".into())]),
    ));
    let tree = SideTree {
        _base: None,
        sources: Arc::new(sources),
        dependencies: Arc::new(dependencies),
        usage: Arc::new(Unimock::new(())),
        aliases: Default::default(),
        root: "/repo".into(),
        dependency_roots: vec!["/deps/node_modules".into()],
        repository_roots: vec![],
    };
    let results: Vec<_> = tree
        .digest_unretained_batch(&[
            "/repo/a.svg".into(),
            "/repo/node_modules/pkg/b.svg".into(),
            "/repo/c.svg".into(),
        ])
        .into_iter()
        .map(Result::unwrap)
        .collect();
    assert_eq!(results, ["a", "b", "c"]);
}
