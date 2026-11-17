//! New pools and real sidecars reuse one temporary disk entry across source changes.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_compare::bundle_store::CachedBundles;
use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::bundle_outcomes::CacheOutcome;
use mokly_sidecar::methods::{Bundle, Call};
use mokly_sidecar::operations::Operation;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::results;
use mokly_sidecar::workers::Diagnostics;

#[path = "../../../tests/rust/package_version.rs"]
mod package_version;

#[expect(
    dead_code,
    reason = "cache composition is shared with the other integration tests"
)]
mod support;

#[derive(Default)]
struct Counts(AtomicUsize);
impl Diagnostics for Counts {
    fn emit(&self, message: &str) {
        eprintln!("{message}");
    }
    fn operation(&self, operation: Operation, _: u32) {
        if operation == Operation::Esbuild {
            self.0.fetch_add(1, Ordering::SeqCst);
        }
    }
}

fn pool(source: &Path, cache: &Path, counts: Arc<Counts>) -> Pool {
    let clock = Arc::new(SystemClock::new());
    let workspace =
        dunce::canonicalize(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")).unwrap();
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
            repository: source.into(),
            version: package_version::read(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    )
    .with_bundle_store(Arc::new(CachedBundles::new(
        Arc::new(support::cache(cache.into(), 1)),
        package_version::read(),
    )))
}

fn bundle(pool: &Pool, source: &Path) -> results::Bundle {
    pool.request(Call::Bundle(Bundle {
        evaluation: None,
        entry_files: vec!["entry.ts".into()],
        renderer: None,
        stories_files: vec![],
        source_root: source.to_string_lossy().into_owned(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
    }))
    .unwrap()
    .into_bundle()
}

#[test]
fn fresh_sidecars_skip_esbuild_and_changed_inputs_replace_the_disk_recipe() {
    let temporary = tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let source = root.join("source");
    let cache = root.join("cache");
    fs::create_dir(&source).unwrap();
    fs::create_dir(&cache).unwrap();
    fs::write(source.join("package.json"), "{}").unwrap();
    fs::write(source.join("tsconfig.json"), "{}").unwrap();
    let entry = source.join("entry.ts");
    fs::write(&entry, "export const value = 'X';").unwrap();
    let first_counts = Arc::new(Counts::default());
    let first = pool(&source, &cache, first_counts.clone());
    let original = bundle(&first, &source);
    assert_eq!(original.cache, Some(CacheOutcome::NoRecord));
    assert_eq!(first_counts.0.load(Ordering::SeqCst), 1);
    first.shutdown().unwrap();

    let second_counts = Arc::new(Counts::default());
    let second = pool(&source, &cache, second_counts.clone());
    let restored = bundle(&second, &source);
    assert_eq!(second_counts.0.load(Ordering::SeqCst), 0);
    assert_eq!(restored.cache, Some(CacheOutcome::Hit));
    assert_eq!(restored.compiled.runtime_key, original.compiled.runtime_key);
    fs::write(entry, "export const value = 'Y';").unwrap();
    let changed = bundle(&second, &source);
    assert_eq!(changed.cache, Some(CacheOutcome::StampMismatch));
    assert_ne!(changed.generation, original.generation);
    assert_eq!(second_counts.0.load(Ordering::SeqCst), 1);
    second.shutdown().unwrap();

    let final_counts = Arc::new(Counts::default());
    let final_pool = pool(&source, &cache, final_counts.clone());
    let final_bundle = bundle(&final_pool, &source);
    assert_eq!(final_bundle.cache, Some(CacheOutcome::Hit));
    assert_eq!(
        final_bundle.compiled.runtime_key,
        changed.compiled.runtime_key
    );
    assert_eq!(final_counts.0.load(Ordering::SeqCst), 0);
    fs::remove_dir_all(&cache).unwrap();
    final_pool.served_generation(&final_bundle.generation, final_bundle.epoch);
    final_pool.shutdown().unwrap();

    let recreated_counts = Arc::new(Counts::default());
    let recreated = pool(&source, &cache, recreated_counts.clone());
    let restored_after_deletion = bundle(&recreated, &source);
    assert_eq!(recreated_counts.0.load(Ordering::SeqCst), 0);
    assert_eq!(restored_after_deletion.cache, Some(CacheOutcome::Hit));
    assert_eq!(
        restored_after_deletion.compiled.runtime_key,
        changed.compiled.runtime_key
    );
    recreated.shutdown().unwrap();
}
