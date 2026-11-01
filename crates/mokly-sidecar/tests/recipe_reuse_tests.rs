//! Released compilation reuse and invalidation count real esbuild operations.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::methods::{Bundle, Call};
use mokly_sidecar::operations::Operation;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::results;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::Diagnostics;

#[path = "../../../tests/rust/package_version.rs"]
mod package_version;

#[derive(Default)]
struct Counts(AtomicUsize);

impl Diagnostics for Counts {
    fn emit(&self, message: &str) {
        eprintln!("{message}");
    }
    fn operation(&self, operation: Operation, _pid: u32) {
        if operation == Operation::Esbuild {
            self.0.fetch_add(1, Ordering::SeqCst);
        }
    }
}

fn bundle(pool: &Pool, params: &Bundle) -> results::Bundle {
    let MethodResult::Bundle(result) = pool.request(Call::Bundle(params.clone())).unwrap() else {
        panic!("expected bundle")
    };
    result
}

fn pool(root: &Path, counts: Arc<Counts>) -> Pool {
    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let clock = Arc::new(SystemClock::new());
    Pool::new(
        Arc::new(NodeFactory::new(
            Arc::new(SystemProcessGroups),
            clock.clone(),
            counts,
            Arc::new(SystemMemory),
        )),
        clock,
        Launch {
            node: "node".into(),
            entry: workspace.join("packages/mokly/dist/sidecar.js"),
            repository: root.into(),
            version: package_version::read(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    )
}

/// Use the real source identity that Node and catalogue configuration retain.
fn settings(root: &Path) -> Bundle {
    let root = dunce::canonicalize(root).unwrap();
    Bundle {
        evaluation: None,
        entry_files: vec!["entry.ts".into()],
        stories_files: Vec::new(),
        renderer: None,
        source_root: root.to_string_lossy().into_owned(),
        configuration_directory: ".".into(),
        repository_roots: Vec::new(),
        module_resolution: Default::default(),
    }
}

#[test]
fn a_released_recipe_skips_esbuild_after_a_revert_and_changed_inputs_compile() {
    let root = tempfile::tempdir().unwrap();
    let entry = root.path().join("entry.ts");
    fs::write(&entry, "export const value = 'X';").unwrap();
    let counts = Arc::new(Counts::default());
    let pool = pool(root.path(), counts.clone());
    let params = settings(root.path());
    let original = bundle(&pool, &params);
    assert_eq!(counts.0.load(Ordering::SeqCst), 1);
    fs::write(&entry, "export const value = 'Y';").unwrap();
    let edited = bundle(&pool, &params);
    assert_eq!(counts.0.load(Ordering::SeqCst), 2);
    assert_ne!(original.generation, edited.generation);
    pool.release_generation(&original.generation, original.epoch);
    fs::write(&entry, "export const value = 'X';").unwrap();
    let reverted = bundle(&pool, &params);
    assert_eq!(
        counts.0.load(Ordering::SeqCst),
        2,
        "a released recipe must skip esbuild"
    );
    assert_eq!(reverted.generation, original.generation);
    pool.release_generation(&reverted.generation, reverted.epoch);
    fs::write(&entry, "export const value = 'Z';").unwrap();
    let changed = bundle(&pool, &params);
    assert_eq!(
        counts.0.load(Ordering::SeqCst),
        3,
        "changed inputs must compile"
    );
    assert_ne!(changed.generation, original.generation);
    pool.shutdown().unwrap();
}

#[test]
fn stored_and_live_recipes_with_the_same_id_both_reach_the_input_check() {
    let root = tempfile::tempdir().unwrap();
    fs::write(root.path().join("entry.ts"), "export const value = 'X';").unwrap();
    let counts = Arc::new(Counts::default());
    let pool = pool(root.path(), counts.clone());
    let params = settings(root.path());
    let original = bundle(&pool, &params);
    pool.release_generation(&original.generation, original.epoch);
    let added = root.path().join("added.txt");
    fs::write(&added, "a new directory member").unwrap();
    let changed = bundle(&pool, &params);
    assert_eq!(changed.generation, original.generation);
    assert_eq!(counts.0.load(Ordering::SeqCst), 2);
    bundle(&pool, &params);
    assert_eq!(
        counts.0.load(Ordering::SeqCst),
        2,
        "the live directory recipe must remain available"
    );
    fs::remove_file(added).unwrap();
    bundle(&pool, &params);
    assert_eq!(
        counts.0.load(Ordering::SeqCst),
        2,
        "the released directory recipe must remain available"
    );
    pool.shutdown().unwrap();
}
