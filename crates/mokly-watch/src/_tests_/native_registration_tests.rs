//! Captured native batches prove pruned traversal and stable observer ownership.

use std::collections::{BTreeMap, BTreeSet};
use std::io;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_css::watch_inputs::WatchInputs;
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{DirectoryWatch, DirectoryWatchMock, WatchFactoryMock};
use crate::observer::Observer;
use crate::plan::Plan;

use super::NativeObserver;

pub(super) fn paths(values: &[&str]) -> BTreeSet<PathBuf> {
    values.iter().map(|value| path(value)).collect()
}

pub(super) fn path(value: &str) -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(value.replace('/', "\\"))
    } else {
        PathBuf::from(value)
    }
}

pub(super) fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: path("/repo/mokly.config.json"),
        repo_root: path("/repo"),
        modules: Default::default(),
        authored_inputs: vec![],
        roots: vec![ResolvedRoot {
            directory: path("/repo/specs"),
            identity: path("/repo/specs"),
            input: RootConfig {
                dir: "specs".into(),
                files: None,
                path: None,
                transparent: None,
            },
        }],
    }
}

#[test]
fn exact_files_extend_one_observer_without_rewatching_existing_directories() {
    for file_count in [1, 4] {
        registrations(file_count);
    }
}

fn registrations(file_count: usize) {
    let projections = Arc::new(Mutex::new(BTreeMap::<PathBuf, usize>::new()));
    let captured = projections.clone();
    let escaped = Arc::new(AtomicBool::new(false));
    let changed = escaped.clone();
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, candidate| {
                let attempt = {
                    let mut calls = captured.lock().unwrap();
                    let count = calls.entry(candidate.into()).or_default();
                    *count += 1;
                    *count
                };
                if candidate == path("/repo/retry/io") && attempt == 1 {
                    return Err(SourceError::Io {
                        operation: "project",
                        path: candidate.into(),
                        source: io::Error::from(io::ErrorKind::PermissionDenied),
                    });
                }
                if candidate == path("/repo/retry/cancel") && attempt == 1 {
                    return Err(SourceError::Cancelled {
                        path: candidate.into(),
                    });
                }
                Ok(Some(Node {
                    identity: if candidate == path("/repo/assets") && changed.load(Ordering::SeqCst)
                    {
                        path("/escaped")
                    } else {
                        candidate.into()
                    },
                    lexical_kind: FileKind::Directory,
                    kind: FileKind::Directory,
                }))
            })),
        SourceTreeMock::children
            .each_call(matching!((candidate) if candidate == &path("/repo/specs")))
            .answers(&|_, _| {
                Ok(vec![
                    Child {
                        name: "src".into(),
                        kind: FileKind::Directory,
                    },
                    Child {
                        name: "target".into(),
                        kind: FileKind::Directory,
                    },
                    Child {
                        name: "linked".into(),
                        kind: FileKind::Symlink,
                    },
                ])
            }),
        SourceTreeMock::children
            .each_call(matching!((candidate) if candidate == &path("/repo/specs/src")))
            .answers(&|_, _| Ok(vec![])),
    )));
    let watch = Unimock::new((
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo", "/repo/specs", "/repo/specs/src"]) && remove.is_empty())).returns(Ok(paths(&["/repo", "/repo/specs", "/repo/specs/src"]))),
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo/assets"]) && remove.is_empty())).returns(Ok(paths(&["/repo/assets"]))),
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo/retry", "/repo/retry/io", "/repo/retry/cancel"]) && remove.is_empty())).returns(Ok(paths(&["/repo/retry", "/repo/retry/io", "/repo/retry/cancel"]))),
        DirectoryWatchMock::update.next_call(matching!((add, remove) if add.is_empty() && **remove == paths(&["/repo/assets"])) ).returns(Ok(BTreeSet::new())),
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo/assets"]) && remove.is_empty())).returns(Ok(paths(&["/repo/assets"]))),
    ));
    let factory = Arc::new(Unimock::new(
        WatchFactoryMock::create
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Box::new(watch.clone()) as Box<dyn DirectoryWatch>)
            }))
            .n_times(1),
    ));
    let mut plan = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    let observer: &dyn Observer = &NativeObserver::with_factory(tree, &plan, factory).unwrap();
    assert_eq!(
        projections.lock().unwrap().get(&path("/repo")),
        Some(&1),
        "file_count={file_count}"
    );
    plan.resources(&BTreeSet::from(["specs/src/image.svg".into()]));
    observer.replace(&plan).unwrap();
    projections.lock().unwrap().clear();
    let files: BTreeSet<String> = [
        "assets/image.svg",
        "assets/second.svg",
        "assets/third.svg",
        "assets/fourth.svg",
    ]
    .into_iter()
    .take(file_count)
    .map(str::to_owned)
    .collect();
    plan.resources(&files);
    plan.resolution(
        &WatchInputs::default(),
        &BTreeMap::from([("assets".into(), BTreeSet::new())]),
        None,
        None,
    );
    observer.replace(&plan).unwrap();
    assert_eq!(
        projections.lock().unwrap().get(&path("/repo")),
        Some(&1),
        "file_count={file_count}"
    );
    assert_eq!(
        projections.lock().unwrap().get(&path("/repo/assets")),
        Some(&1),
        "parents and membership self check share projections; file_count={file_count}"
    );
    observer.replace(&plan).unwrap();
    projections.lock().unwrap().clear();
    observer.rescan(&plan).unwrap();
    assert_eq!(projections.lock().unwrap().get(&path("/repo")), Some(&1));
    assert_eq!(
        projections.lock().unwrap().get(&path("/repo/assets")),
        Some(&1)
    );
    projections.lock().unwrap().clear();
    plan.resources(&BTreeSet::from([
        "retry/io/one.svg".into(),
        "retry/io/two.svg".into(),
        "retry/cancel/one.svg".into(),
        "retry/cancel/two.svg".into(),
    ]));
    observer.replace(&plan).unwrap();
    assert_eq!(
        projections.lock().unwrap().get(&path("/repo/retry/io")),
        Some(&2)
    );
    assert_eq!(
        projections.lock().unwrap().get(&path("/repo/retry/cancel")),
        Some(&2)
    );
    assert_eq!(
        projections.lock().unwrap().get(&path("/repo/retry")),
        Some(&1)
    );
    escaped.store(true, Ordering::SeqCst);
    observer.rescan(&plan).unwrap();
    assert!(!observer.observes(&path("/repo/assets")));
    escaped.store(false, Ordering::SeqCst);
    observer.rescan(&plan).unwrap();
    assert!(observer.observes(&path("/repo/assets")));
    observer.close();
    observer.replace(&plan).unwrap();
}
