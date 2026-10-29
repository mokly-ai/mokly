//! A PostCSS context projects and hashes each of its modules once for all of its results.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use mokly_sidecar::methods::ModuleResolution;
use mokly_sidecar::postcss_evidence::Evidence;
use mokly_source_interface::error::SourceError;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::postcss_inventory::Inventory;
use crate::postcss_read_inventory::{ModuleDigests, collect};
use crate::side::SideInputs;

const MODULES: usize = 40;

fn side() -> SideInputs {
    SideInputs {
        source_root: "/repo".into(),
        repository_roots: vec!["/repo".into()],
        dependency_roots: vec!["/repo/node_modules".into()],
        dependency_aliases: BTreeMap::new(),
        configuration_directory: String::new(),
        module_resolution: ModuleResolution::default(),
        context: "head".into(),
    }
}

fn evidence(modules: usize) -> Evidence {
    Evidence {
        modules: (0..modules)
            .map(|index| format!("/repo/node_modules/plugin/module-{index}.js"))
            .collect(),
        ..Default::default()
    }
}

fn inventory() -> Inventory {
    Inventory {
        inputs: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: Vec::new(),
    }
}

fn node(path: &Path) -> Node {
    Node {
        identity: path.into(),
        lexical_kind: FileKind::File,
        kind: FileKind::File,
    }
}

/// The project and digest calls of `results` results of one context with the same modules.
fn calls(results: usize) -> (usize, usize) {
    let projects = Arc::new(AtomicUsize::new(0));
    let digests = Arc::new(AtomicUsize::new(0));
    let (projected, digested) = (projects.clone(), digests.clone());
    let tree = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                projected.fetch_add(1, Ordering::SeqCst);
                Ok(Some(node(path)))
            })),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                digested.fetch_add(1, Ordering::SeqCst);
                Ok("late".into())
            })),
    ));
    let memo = ModuleDigests::default();
    for _ in 0..results {
        let result = collect(
            &tree,
            Path::new("/repo"),
            &side(),
            &inventory(),
            &evidence(MODULES),
            &memo,
        );
        assert_eq!(result.inputs.len(), MODULES);
        let late = ReadBaseline::Late("late".into());
        assert!(
            result
                .inputs
                .values()
                .all(|versions| versions.contains(&late))
        );
    }
    (
        projects.load(Ordering::SeqCst),
        digests.load(Ordering::SeqCst),
    )
}

#[test]
fn later_results_of_a_context_project_and_hash_no_module_again() {
    assert_eq!(calls(2), (MODULES, MODULES));
    assert_eq!(calls(8), (MODULES, MODULES));
}

#[test]
fn a_module_that_the_tree_could_not_read_is_asked_again() {
    let tree = Unimock::new((
        SourceTreeMock::project
            .next_call(matching!(_))
            .answers(&|_, path| Err(SourceError::Changed { path: path.into() })),
        SourceTreeMock::project
            .next_call(matching!(_))
            .answers(&|_, path| Ok(Some(node(path)))),
        SourceTreeMock::digest
            .next_call(matching!(_))
            .returns(Ok("late".into())),
    ));
    let memo = ModuleDigests::default();
    let inventory = inventory();
    let root = Path::new("/repo");
    let first = collect(&tree, root, &side(), &inventory, &evidence(1), &memo);
    assert!(first.inputs.is_empty());
    let second = collect(&tree, root, &side(), &inventory, &evidence(1), &memo);
    assert_eq!(second.inputs.len(), 1);
}

#[test]
fn finding_7_parallel_missing_module_work_uses_one_project_and_digest() {
    let polling = Duration::from_secs(10);
    let (first_started, first_ready) = mpsc::channel();
    let (duplicate, duplicate_seen) = mpsc::channel();
    let (release_tx, released) = mpsc::channel();
    let first = Arc::new(AtomicUsize::new(0));
    let projects = Arc::new(AtomicUsize::new(0));
    let digests = Arc::new(AtomicUsize::new(0));
    let first_project = first.clone();
    let project_count = projects.clone();
    let digest_count = digests.clone();
    let release_wait = Arc::new(Mutex::new(released));
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                project_count.fetch_add(1, Ordering::SeqCst);
                if first_project.fetch_add(1, Ordering::SeqCst) == 0 {
                    first_started.send(()).unwrap();
                    release_wait
                        .lock()
                        .unwrap()
                        .recv_timeout(polling + polling)
                        .unwrap();
                } else {
                    duplicate.send(()).unwrap();
                }
                Ok(Some(node(path)))
            })),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                digest_count.fetch_add(1, Ordering::SeqCst);
                Ok("late".into())
            })),
    )));
    let memo = Arc::new(ModuleDigests::default());
    let first_memo = memo.clone();
    let first_tree = tree.clone();
    let first_thread = thread::spawn(move || {
        first_memo.late(first_tree.as_ref(), Path::new("/repo"), "module.js")
    });
    first_ready.recv_timeout(polling).unwrap();
    let second_memo = memo.clone();
    let second_tree = tree.clone();
    let second_thread = thread::spawn(move || {
        second_memo.late(second_tree.as_ref(), Path::new("/repo"), "module.js")
    });
    let duplicate_observed = duplicate_seen.recv_timeout(polling);
    release_tx.send(()).unwrap();

    assert_eq!(first_thread.join().unwrap(), Some("late".into()));
    assert_eq!(second_thread.join().unwrap(), Some("late".into()));
    assert!(duplicate_observed.is_err());
    assert_eq!(projects.load(Ordering::SeqCst), 1);
    assert_eq!(digests.load(Ordering::SeqCst), 1);
}
