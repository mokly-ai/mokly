//! External exact inputs retain their own boundaries and advisory attachment failures.
//! A canonical cache namespace can lie outside the OS cache without denying its siblings.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{DirectoryWatch, DirectoryWatchMock, WatchFactoryMock};
use crate::error::Error;
use crate::event::{Event, Kind};
use crate::native::NativeObserver;
use crate::observer::Observer;
use crate::plan::Plan;

use super::native_registration_tests::{config, path, paths};

fn tree(walks: Arc<Mutex<BTreeSet<PathBuf>>>) -> Arc<dyn SourceTree> {
    Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, candidate| {
                Ok(Some(Node {
                    identity: if candidate == path("/deps/node_modules/theme/alias") {
                        path("/escaped")
                    } else {
                        candidate.into()
                    },
                    kind: FileKind::Directory,
                    lexical_kind: FileKind::Directory,
                }))
            }),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, directory| {
                walks.lock().unwrap().insert(directory.into());
                Ok(vec![])
            })),
    )))
}

fn plan() -> Plan {
    let mut plan = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    let files = [
        "/deps/node_modules/theme/tokens.css",
        "/deps/node_modules/theme/alias/child.css",
        "/deps/node_modules/theme/escaped.css",
        "/nested/node_modules/pkg/package.json",
        "/cache/mokly/cache.css",
        "/shared/install/theme/tokens.css",
        "/shared/mokly/base/cache.css",
        "/outside/escaped.svg",
    ]
    .map(str::to_owned)
    .into();
    let roots = BTreeMap::from([
        (
            "/deps/node_modules/theme/tokens.css".into(),
            path("/deps/node_modules"),
        ),
        (
            "/deps/node_modules/theme/alias/child.css".into(),
            path("/deps/node_modules"),
        ),
        (
            "/nested/node_modules/pkg/package.json".into(),
            path("/nested/node_modules"),
        ),
        ("/cache/mokly/cache.css".into(), path("/cache/mokly")),
        (
            "/shared/install/theme/tokens.css".into(),
            path("/shared/install"),
        ),
        ("/shared/mokly/base/cache.css".into(), path("/shared/mokly")),
    ]);
    plan.stylesheet_resolution(
        &files,
        &roots,
        Some(&path("/cache")),
        Some(&path("/shared/mokly")),
    );
    plan
}

#[test]
fn external_registrations_are_confined_per_input_and_refresh_changed_boundaries() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let captured = calls.clone();
    let watch = Unimock::new(
        DirectoryWatchMock::update
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, add, remove| {
                captured.lock().unwrap().push((add.clone(), remove.clone()));
                Ok(add.clone())
            })),
    );
    let factory = Arc::new(Unimock::new(
        WatchFactoryMock::create
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Box::new(watch.clone()) as Box<dyn DirectoryWatch>)
            })),
    ));
    let mut plan = plan();
    let walks = Arc::new(Mutex::new(BTreeSet::new()));
    let observer = NativeObserver::with_factory(tree(walks.clone()), &plan, factory).unwrap();
    let registered: BTreeSet<_> = calls
        .lock()
        .unwrap()
        .iter()
        .flat_map(|(add, _)| add.iter().cloned())
        .collect();
    assert_eq!(
        registered,
        paths(&[
            "/repo",
            "/repo/specs",
            "/deps/node_modules",
            "/deps/node_modules/theme",
            "/nested/node_modules",
            "/nested/node_modules/pkg",
            "/shared/install",
            "/shared/install/theme",
        ])
    );
    assert_eq!(*walks.lock().unwrap(), paths(&["/repo/specs"]));
    for escaped in [
        "/deps/node_modules/theme/escaped.css",
        "/cache/mokly/cache.css",
        "/shared/mokly/base/cache.css",
        "/outside/escaped.svg",
    ] {
        assert_eq!(
            plan.classify(&Event {
                path: path(escaped),
                kind: Kind::File
            }),
            None
        );
    }
    let files = BTreeSet::from([
        "/deps/node_modules/theme/tokens.css".into(),
        "/deps/node_modules/theme/alias/child.css".into(),
    ]);
    plan.stylesheet_resolution(
        &files,
        &BTreeMap::from([
            (
                "/deps/node_modules/theme/tokens.css".into(),
                path("/deps/node_modules/theme"),
            ),
            (
                "/deps/node_modules/theme/alias/child.css".into(),
                path("/deps/node_modules/theme"),
            ),
        ]),
        Some(Path::new("/cache")),
        None,
    );
    observer.replace(&plan).unwrap();
    assert_eq!(
        calls.lock().unwrap().last().unwrap().1,
        paths(&["/deps/node_modules"])
    );
    assert!(!observer.observes(&path("/deps/node_modules")));
    assert!(observer.observes(&path("/deps/node_modules/theme")));
    observer.close();
}

#[test]
fn external_attachment_failure_warns_without_blocking_startup_or_adoption() {
    for initial in [false, true] {
        let watch = Unimock::new(
            DirectoryWatchMock::update
                .each_call(matching!(_, _))
                .answers(&|_, add, _| {
                    if add
                        .iter()
                        .any(|candidate| !candidate.starts_with(path("/repo")))
                    {
                        Err(Error::Observer {
                            source: notify::Error::generic("external attachment failed"),
                        })
                    } else {
                        Ok(add.clone())
                    }
                }),
        );
        let factory = Arc::new(Unimock::new(
            WatchFactoryMock::create
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(Box::new(watch.clone()) as Box<dyn DirectoryWatch>)
                })),
        ));
        let plan = plan();
        let base = if initial {
            plan.clone()
        } else {
            Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap()
        };
        let result = NativeObserver::with_factory(tree(Arc::default()), &base, factory);
        assert!(result.is_ok(), "external attachment must preserve startup");
        let observer = result.unwrap();
        let adoption = if initial {
            Ok(())
        } else {
            observer.replace(&plan)
        };
        let repository_observed = observer.observes(&path("/repo"));
        let external_observed = observer.observes(&path("/deps/node_modules"));
        let errors = observer.take();
        observer.close();
        assert!(
            adoption.is_ok(),
            "external attachment must preserve adoption"
        );
        assert!(repository_observed);
        assert!(!external_observed);
        assert_eq!(errors.len(), 1);
        assert!(matches!(&errors[0], Err(Error::Observer { .. })));
    }
}
