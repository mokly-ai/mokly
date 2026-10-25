//! Scattered reads never fetch unrelated large objects and release cache locks before IO.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock, Weak};

use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::tree::{Entry, Mode};
use mokly_source_interface::tree::SourceTree;
use unimock::{MockFn, Unimock, matching};

use crate::git_tree::GitTree;
use crate::sources::{SourcesMock, TreeIndex};

#[test]
fn requested_scattered_targets_have_linear_small_blob_reads_despite_large_neighbors() {
    let run = |size| {
        let mut entries = BTreeMap::new();
        for (name, bytes) in (0..size)
            .flat_map(|index| {
                [
                    (format!("a/{index}.svg"), 64),
                    (format!("z/{index}.svg"), 64),
                ]
            })
            .chain((0..60).map(|index| (format!("m-big/{index}"), 1024 * 1024)))
        {
            let path = RepoPath::parse(&name).unwrap();
            entries.insert(
                path.clone(),
                Entry {
                    path,
                    mode: Mode::File,
                    size: bytes,
                    object: ObjectId::parse(&"a".repeat(40)).unwrap(),
                },
            );
        }
        let index = Arc::new(TreeIndex { entries });
        let reads = Arc::new(AtomicUsize::new(0));
        let bytes = Arc::new(AtomicUsize::new(0));
        let weak: Arc<OnceLock<Weak<GitTree>>> = Arc::new(OnceLock::new());
        let observed = (reads.clone(), bytes.clone(), weak.clone());
        let source = Unimock::new((
            SourcesMock::index
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| Ok(index.clone()))),
            SourcesMock::read_many
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, paths, _| {
                    assert!(
                        observed
                            .2
                            .get()
                            .unwrap()
                            .upgrade()
                            .unwrap()
                            .cache
                            .try_lock()
                            .is_ok()
                    );
                    assert!(
                        paths
                            .iter()
                            .all(|path| !path.as_str().starts_with("m-big/"))
                    );
                    assert!(paths.len() <= 2);
                    observed.0.fetch_add(1, Ordering::SeqCst);
                    observed.1.fetch_add(paths.len() * 64, Ordering::SeqCst);
                    Ok(paths.iter().map(|_| vec![0; 64]).collect())
                })),
        ));
        let tree = Arc::new(GitTree::new(
            PathBuf::from("/repo"),
            Arc::new(source),
            32768,
        ));
        weak.set(Arc::downgrade(&tree)).unwrap();
        for _ in 0..2 {
            for index in 0..size {
                let paths = [
                    PathBuf::from(format!("/repo/a/{index}.svg")),
                    PathBuf::from(format!("/repo/z/{index}.svg")),
                ];
                tree.prefetch(&paths).unwrap();
                for path in paths {
                    assert_eq!(tree.read(&path).unwrap().len(), 64);
                }
            }
        }
        (reads.load(Ordering::SeqCst), bytes.load(Ordering::SeqCst))
    };
    let small = run(8);
    let large = run(32);
    assert_eq!(small, (8, 1024));
    assert_eq!(large, (4 * small.0, 4 * small.1));
}
