//! Native registration retries, root replacement, directory noise, and PostCSS targets.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_css::dependencies::{DirectoryDependency, PluginInput};
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{DirectoryWatch, DirectoryWatchMock, WatchFactoryMock};
use crate::error::Error;
use crate::event::{Event, Kind};
use crate::observer::Observer;
use crate::plan::Plan;

use super::NativeObserver;
use super::native_registration_tests::{config, paths};

fn tree() -> Arc<dyn SourceTree> {
    Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    kind: FileKind::Directory,
                    lexical_kind: FileKind::Directory,
                }))
            }),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers(&|_, _| Ok(vec![])),
    )))
}
fn factory(watchers: Vec<Unimock>) -> Arc<dyn crate::backend::WatchFactory> {
    let watchers = std::sync::Mutex::new(watchers.into_iter());
    Arc::new(Unimock::new(
        WatchFactoryMock::create
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Box::new(watchers.lock().unwrap().next().unwrap()) as Box<dyn DirectoryWatch>)
            })),
    ))
}
#[test]
fn vanished_additions_stay_untracked_and_are_retried() {
    let watch = Unimock::new((
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo", "/repo/specs"]) && remove.is_empty())).returns(Ok(paths(&["/repo"]))),
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo/specs"]) && remove.is_empty())).returns(Ok(paths(&["/repo/specs"]))),
    ));
    let plan = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    let observer = NativeObserver::with_factory(tree(), &plan, factory(vec![watch])).unwrap();
    observer.replace(&plan).unwrap();
    assert_eq!(
        observer.state.lock().unwrap().as_ref().unwrap().directories,
        paths(&["/repo", "/repo/specs"])
    );
}
#[test]
fn failed_root_attachment_keeps_the_previous_observer_and_targets() {
    let first = Unimock::new(
        DirectoryWatchMock::update
            .next_call(matching!(_, _))
            .returns(Ok(paths(&["/repo", "/repo/specs"]))),
    );
    let failed = Unimock::new(
        DirectoryWatchMock::update
            .next_call(matching!((add, _) if add.contains(&std::path::PathBuf::from("/repo/new"))))
            .returns(Err(Error::Observer {
                source: notify::Error::generic("fixture attach failure"),
            })),
    );
    let next = Unimock::new(
        DirectoryWatchMock::update
            .next_call(matching!(_, _))
            .returns(Ok(paths(&["/repo", "/repo/new"]))),
    );
    let original = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    let mut changed = original.clone();
    changed.roots = paths(&["/repo/new"]);
    let observer =
        NativeObserver::with_factory(tree(), &original, factory(vec![first, failed, next]))
            .unwrap();
    assert!(observer.replace(&changed).is_err());
    assert_eq!(
        observer.state.lock().unwrap().as_ref().unwrap().roots,
        original.roots
    );
    observer.replace(&original).unwrap();
    observer.replace(&changed).unwrap();
    assert_eq!(
        observer.state.lock().unwrap().as_ref().unwrap().roots,
        changed.roots
    );
}
#[test]
fn postcss_directory_roots_are_attached_without_their_source_files() {
    let directories = [DirectoryDependency {
        path: "content".into(),
        glob: "*.txt".into(),
        origin: PluginInput {
            plugin: "fixture".into(),
            stylesheet: "style.css".into(),
        },
    }];
    let plan = Plan::new(
        &config(),
        &[],
        &directories,
        &BTreeSet::from(["content/a.txt".into()]),
    )
    .unwrap();
    let watch = Unimock::new(DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo", "/repo/specs", "/repo/content"]) && remove.is_empty())).returns(Ok(paths(&["/repo", "/repo/specs", "/repo/content"]))));
    NativeObserver::with_factory(tree(), &plan, factory(vec![watch]))
        .unwrap()
        .close();
}
#[test]
fn unspecified_directory_modifications_are_dropped_before_replacement() {
    let plan = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    let watch = Unimock::new(
        DirectoryWatchMock::update
            .next_call(matching!(_, _))
            .returns(Ok(paths(&["/repo", "/repo/specs"]))),
    );
    let observer = NativeObserver::with_factory(tree(), &plan, factory(vec![watch])).unwrap();
    observer.replay(vec![Ok(Event {
        path: "/repo/specs".into(),
        kind: Kind::Modify,
    })]);
    assert!(observer.take().is_empty());
    assert!(
        observer
            .state
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .replaced
            .is_empty()
    );
    observer.rescan(&plan).unwrap();
}
#[test]
#[cfg(any(target_os = "linux", target_os = "android", target_os = "windows"))]
fn directory_replacement_removes_and_adds_the_same_path_in_one_batch() {
    let plan = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    let watch = Unimock::new((
        DirectoryWatchMock::update.next_call(matching!(_, _)).returns(Ok(paths(&["/repo", "/repo/specs"]))),
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo/specs"]) && **remove == paths(&["/repo/specs"])) ).returns(Ok(paths(&["/repo/specs"]))),
    ));
    let observer = NativeObserver::with_factory(tree(), &plan, factory(vec![watch])).unwrap();
    observer.replay(vec![Ok(Event {
        path: "/repo/specs".into(),
        kind: Kind::Rename,
    })]);
    assert_eq!(observer.take()[0].as_ref().unwrap().kind, Kind::Directory);
    observer.rescan(&plan).unwrap();
    observer.rescan(&plan).unwrap();
}
