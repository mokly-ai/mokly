//! New lexical resources extend only their own confined ancestors before returning.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{DirectoryWatch, DirectoryWatchMock, WatchFactoryMock};
use crate::error::Error;
use crate::native::NativeObserver;
use crate::native::native_registration_tests::{config, path, paths};
use crate::observer::Observer;
use crate::plan::Plan;

#[test]
fn new_resource_attachment_is_synchronous_confined_and_retryable() {
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, candidate| {
                Ok(Some(Node {
                    identity: if *candidate == path("/repo/alias") {
                        path("/outside")
                    } else {
                        candidate.into()
                    },
                    lexical_kind: FileKind::Directory,
                    kind: FileKind::Directory,
                }))
            }),
        SourceTreeMock::children
            .some_call(matching!((candidate) if **candidate == path("/repo/specs")))
            .returns(Ok(vec![])),
    )));
    let initial = paths(&["/repo", "/repo/specs"]);
    let resource = paths(&["/repo/assets"]);
    let watcher = Unimock::new((
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo", "/repo/specs"]) && remove.is_empty())).returns(Ok(initial)),
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo/assets"]) && remove.is_empty())).returns(Err(Error::Rescan)),
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo/assets"]) && remove.is_empty())).returns(Ok(resource)),
    ));
    let factory = Arc::new(Unimock::new(
        WatchFactoryMock::create
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Box::new(watcher.clone()) as Box<dyn DirectoryWatch>)
            })),
    ));
    let mut plan = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    let observer = NativeObserver::with_factory(tree, &plan, factory).unwrap();
    assert!(matches!(
        observer.resource(&path("/repo/assets/image.svg")),
        Err(Error::Rescan)
    ));
    assert!(!observer.observes(&path("/repo/assets")));
    observer.resource(&path("/repo/assets/image.svg")).unwrap();
    assert!(
        observer.observes(&path("/repo/assets")),
        "the directory must be registered when attachment returns"
    );
    observer.resource(&path("/repo/assets/second.svg")).unwrap();
    observer.resource(&path("/repo/specs/image.svg")).unwrap();
    observer.resource(&path("/repo/alias/image.svg")).unwrap();
    assert!(!observer.observes(&path("/outside")));
    assert!(!observer.observes(&path("/repo/alias")));
    plan.resources(&BTreeSet::from([
        "assets/image.svg".into(),
        "assets/second.svg".into(),
    ]));
    observer.replace(&plan).unwrap();
    observer.close();
    observer
        .resource(&path("/repo/after-close/image.svg"))
        .unwrap();
    assert!(!observer.observes(&path("/repo/after-close")));
}
