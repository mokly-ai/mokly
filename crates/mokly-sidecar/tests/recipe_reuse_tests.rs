//! Released compilation reuse and invalidation count real esbuild operations.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::methods::{Bundle, BundleRequest, Call};
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
    let MethodResult::Bundle(result) = pool
        .request(Call::Bundle(BundleRequest {
            preparation: None,
            plan: None,
            params: params.clone(),
            capture: None,
        }))
        .unwrap()
    else {
        panic!("expected bundle")
    };
    *result
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
            capture_durability: false,
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
        vite: false,
        vite_inputs: None,
        evaluation: None,
        entry_files: vec!["entry.ts".into()],
        stories_files: Vec::new(),
        storybook_folders: Default::default(),
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
    assert!(Arc::ptr_eq(&reverted.compiled, &original.compiled));
    assert_eq!(reverted.modules.as_ptr(), original.modules.as_ptr());
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

#[test]
fn released_recipes_reject_an_added_earlier_absolute_paths_target() {
    let directory = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(directory.path()).unwrap();
    fs::create_dir(root.join("one")).unwrap();
    fs::create_dir(root.join("two")).unwrap();
    fs::write(root.join("package.json"), "{}").unwrap();
    fs::write(root.join("one/.keep"), "").unwrap();
    fs::write(root.join("two/value.js"), "export const value='two';").unwrap();
    let written = root.join("written.js").to_string_lossy().replace('\\', "/");
    fs::write(
        root.join("entry.ts"),
        format!(
            "export {{value}} from {};",
            serde_json::to_string(&written).unwrap()
        ),
    )
    .unwrap();
    fs::write(
        root.join("tsconfig.json"),
        serde_json::to_vec(&serde_json::json!({
            "compilerOptions": { "paths": { written: ["./one/value.js", "./two/value.js"] } }
        }))
        .unwrap(),
    )
    .unwrap();
    let counts = Arc::new(Counts::default());
    let pool = pool(&root, counts.clone());
    let params = settings(&root);
    let original = bundle(&pool, &params);
    assert_eq!(
        original
            .modules
            .iter()
            .map(|module| module.path.as_str())
            .collect::<Vec<_>>(),
        ["entry.ts", "two/value.js"]
    );
    assert_eq!(counts.0.load(Ordering::SeqCst), 1);
    pool.release_generation(&original.generation, original.epoch);
    let unchanged = bundle(&pool, &params);
    assert_eq!(
        unchanged.compiled.runtime_key,
        original.compiled.runtime_key
    );
    assert_eq!(counts.0.load(Ordering::SeqCst), 1);
    pool.release_generation(&unchanged.generation, unchanged.epoch);
    fs::write(root.join("one/value.js"), "export const value='one';").unwrap();
    let changed = bundle(&pool, &params);
    assert_eq!(
        changed
            .modules
            .iter()
            .map(|module| module.path.as_str())
            .collect::<Vec<_>>(),
        ["entry.ts", "one/value.js"]
    );
    assert_eq!(counts.0.load(Ordering::SeqCst), 2);
    pool.shutdown().unwrap();
}
