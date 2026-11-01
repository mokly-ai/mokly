//! Metadata batches reach the underlying adapter without losing typed results.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use super::{Faults, InjectedTree};

fn projected(path: &Path) -> Result<Option<Node>> {
    if path.ends_with("missing") {
        Ok(None)
    } else if path.ends_with("unavailable") {
        Err(SourceError::Unavailable {
            path: path.into(),
            message: "adapter unavailable".into(),
        })
    } else {
        Ok(Some(Node {
            identity: path.into(),
            kind: FileKind::File,
            lexical_kind: FileKind::File,
        }))
    }
}

#[test]
fn injected_projection_batch_reaches_inner_adapter() {
    let calls = Arc::new(AtomicUsize::new(0));
    let batch_calls = calls.clone();
    let singles = Arc::new(AtomicUsize::new(0));
    let single_calls = singles.clone();

    let source = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                single_calls.fetch_add(1, Ordering::SeqCst);
                projected(path)
            })),
        SourceTreeMock::project_batch
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, paths| {
                assert_eq!(
                    paths,
                    &[
                        PathBuf::from("/repo/file"),
                        PathBuf::from("/repo/missing"),
                        PathBuf::from("/repo/unavailable")
                    ]
                );
                batch_calls.fetch_add(1, Ordering::SeqCst);
                paths.iter().map(|path| projected(path)).collect()
            })),
    ))
    .no_verify_in_drop();
    let tree = InjectedTree {
        inner: Arc::new(source),
        faults: Faults { names: Vec::new() },
    };
    let paths: Vec<PathBuf> = ["/repo/file", "/repo/missing", "/repo/unavailable"]
        .into_iter()
        .map(PathBuf::from)
        .collect();
    let results = tree.project_batch(&paths);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(singles.load(Ordering::SeqCst), 0);
    assert_eq!(results.len(), 3);
    let mut results = results.into_iter();
    assert_eq!(results.next().unwrap().unwrap().unwrap().identity, paths[0]);
    assert_eq!(results.next().unwrap().unwrap(), None);
    assert!(
        matches!(results.next().unwrap(), Err(SourceError::Unavailable { path, message }) if path == paths[2] && message == "adapter unavailable")
    );
}
