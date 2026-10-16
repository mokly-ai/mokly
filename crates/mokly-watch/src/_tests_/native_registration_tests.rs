//! Captured native batches prove pruned traversal and stable observer ownership.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{DirectoryWatch, DirectoryWatchMock, WatchFactoryMock};
use crate::observer::Observer;
use crate::plan::Plan;

use super::NativeObserver;

fn paths(values: &[&str]) -> BTreeSet<PathBuf> {
    values.iter().map(PathBuf::from).collect()
}

fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![ResolvedRoot {
            directory: "/repo/specs".into(),
            identity: "/repo/specs".into(),
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
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: FileKind::Directory,
                    kind: FileKind::Directory,
                }))
            }),
        SourceTreeMock::children
            .each_call(matching!((path) if path.to_str() == Some("/repo/specs")))
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
            .each_call(matching!((path) if path.to_str() == Some("/repo/specs/src")))
            .answers(&|_, _| Ok(vec![])),
    )));
    let watch = Unimock::new((
        DirectoryWatchMock::update.next_call(matching!((add, remove) if **add == paths(&["/repo", "/repo/specs", "/repo/specs/src"]) && remove.is_empty())).returns(Ok(paths(&["/repo", "/repo/specs", "/repo/specs/src"]))),
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
    plan.resources(&BTreeSet::from(["specs/src/image.svg".into()]));
    observer.replace(&plan).unwrap();
    plan.resources(&BTreeSet::from(["assets/image.svg".into()]));
    observer.replace(&plan).unwrap();
    observer.replace(&plan).unwrap();
    observer.rescan(&plan).unwrap();
    observer.close();
    observer.replace(&plan).unwrap();
}
