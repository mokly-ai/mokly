//! Every side-tree read keeps its dependency mapping and digest-only boundary.

use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::dependency_usage::DependencyUsageMock;
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
