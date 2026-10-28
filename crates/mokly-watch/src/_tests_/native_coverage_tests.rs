//! Coverage compares the directories that a plan's roots need with the registered ones.

use std::collections::BTreeSet;
use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_css::dependencies::{DirectoryDependency, PluginInput};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{DirectoryWatch, DirectoryWatchMock, WatchFactoryMock};
use crate::observer::Observer;
use crate::plan::Plan;

use super::NativeObserver;
use super::native_registration_tests::{config, path};

/// `/repo` holds the configured `specs` root, which holds `src`. `extra` adds
/// `/repo/assets`, and `/repo/styles` lists with a permission error.
fn tree(extra: bool) -> Arc<dyn SourceTree> {
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
            .answers_arc(Arc::new(move |_, directory: &Path| {
                if directory == path("/repo/styles") {
                    return Err(SourceError::Io {
                        operation: "children",
                        path: directory.into(),
                        source: io::Error::from(io::ErrorKind::PermissionDenied),
                    });
                }
                let names: &[&str] = if directory == path("/repo") && extra {
                    &["specs", "assets"]
                } else if directory == path("/repo") {
                    &["specs"]
                } else if directory == path("/repo/specs") {
                    &["src"]
                } else {
                    &[]
                };
                Ok(names
                    .iter()
                    .map(|name| Child {
                        name: (*name).into(),
                        kind: FileKind::Directory,
                    })
                    .collect())
            })),
    )))
}

/// Every requested directory attaches. The handle owns its mock, so it verifies on drop.
fn observer(extra: bool, plan: &Plan) -> NativeObserver {
    let factory = Arc::new(Unimock::new(
        WatchFactoryMock::create
            .next_call(matching!(_))
            .answers(&|_, _| {
                Ok(Box::new(Unimock::new(
                    DirectoryWatchMock::update
                        .each_call(matching!(_, _))
                        .answers(&|_, add, _| Ok(add.clone())),
                )) as Box<dyn DirectoryWatch>)
            }),
    ));
    NativeObserver::with_factory(tree(extra), plan, factory).unwrap()
}

fn configured() -> Plan {
    Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap()
}

fn postcss(directory: &str) -> Plan {
    let directories = [DirectoryDependency {
        path: directory.into(),
        glob: "**/*".into(),
        origin: PluginInput {
            plugin: "fixture".into(),
            stylesheet: "style.css".into(),
        },
    }];
    Plan::new(&config(), &[], &directories, &BTreeSet::new()).unwrap()
}

#[test]
fn a_new_root_below_a_registered_root_is_covered() {
    let observer = observer(false, &configured());
    let candidate = postcss("specs/src");
    assert_ne!(candidate.roots, configured().roots);
    assert!(observer.covers(&candidate));
    assert!(observer.covers(&configured()));
}

#[test]
fn a_new_parent_root_is_covered_only_while_it_holds_no_other_directory() {
    let candidate = postcss(".");
    assert!(candidate.roots.contains(&path("/repo")));
    assert!(observer(false, &configured()).covers(&candidate));
    assert!(!observer(true, &configured()).covers(&candidate));
}

#[test]
fn a_new_root_outside_every_registered_directory_is_not_covered() {
    let observer = observer(false, &configured());
    assert!(!observer.covers(&postcss("specs-copy")));
}

#[test]
fn a_failed_walk_and_a_closed_observer_cover_nothing() {
    let observer = observer(false, &configured());
    assert!(!observer.covers(&postcss("styles")));
    observer.close();
    assert!(!observer.covers(&configured()));
}

#[test]
fn observes_reports_each_registered_directory_until_close() {
    let observer = observer(false, &configured());
    assert!(observer.observes(&path("/repo")));
    assert!(observer.observes(&path("/repo/specs/src")));
    assert!(!observer.observes(&path("/repo/outside")));
    observer.close();
    assert!(!observer.observes(&path("/repo/specs")));
}
