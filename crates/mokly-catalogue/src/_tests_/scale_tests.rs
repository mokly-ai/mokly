//! Discovery scale is measured by source operations, not elapsed time.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::config::{ConfigLoader, Loader};
use crate::discovery::{Discoverer, Discovery};

fn run(size: usize) -> BTreeMap<String, usize> {
    let counts = Arc::new(Mutex::new(BTreeMap::<String, usize>::new()));
    let captured = counts.clone();
    let tree: Arc<dyn SourceTree> = Arc::new(Unimock::new((
        SourceTreeMock::read
            .next_call(matching!((path) if *path==Path::new("/repo/mokly.config.json")))
            .returns(Ok(b"{}".to_vec())),
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                *captured
                    .lock()
                    .unwrap()
                    .entry(path.to_string_lossy().into_owned())
                    .or_default() += 1;
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: if path == Path::new("/repo") || path == Path::new("/repo/specs")
                    {
                        FileKind::Directory
                    } else {
                        FileKind::File
                    },
                    kind: if path == Path::new("/repo") || path == Path::new("/repo/specs") {
                        FileKind::Directory
                    } else {
                        FileKind::File
                    },
                }))
            })),
        SourceTreeMock::children
            .next_call(matching!((path) if *path==Path::new("/repo/specs")))
            .returns(Ok((0..size)
                .map(|index| Child {
                    name: format!("file-{index}.md"),
                    kind: FileKind::File,
                })
                .collect())),
    )));
    let config = Loader { tree: tree.clone() }
        .load(Path::new("/repo"), Some("mokly.config.json"))
        .unwrap();
    let inventory = Discoverer { tree }.discover(&config, None).unwrap();
    assert_eq!(inventory.files.len(), size);
    assert_eq!(inventory.sources.len(), size);
    counts.lock().unwrap().clone()
}

#[test]
fn repository_roots_and_candidates_project_once_with_linear_operation_growth() {
    let smaller = run(32);
    let larger = run(128);
    for path in ["/repo", "/repo/specs", "/repo/mokly.config.json"] {
        assert!(smaller[path] > 0);
        assert_eq!(smaller[path], 1);
        assert_eq!(smaller[path], larger[path]);
    }
    assert!(smaller.values().all(|count| *count == 1));
    assert!(larger.values().all(|count| *count == 1));
    let smaller_total: usize = smaller.values().sum();
    let larger_total: usize = larger.values().sum();
    assert!(smaller_total > 0);
    assert!(larger_total * 2 <= smaller_total * 9);
}
