//! Isolated bundle storage with real files and operating-system locks.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_compare::bundle_cache_types::BundleReceipt;
use mokly_compare::bundle_store::settings_key;
use mokly_compare::cache::DiskCache;
use mokly_compare::cache_types::Reporter;
use mokly_compare::storage::SystemStorage;
use mokly_git::control::{SystemClock, Token};
use mokly_platform::flush::SystemFlush;
use mokly_platform::locks::SystemLocks;
use mokly_sidecar::bundle_store::{ReadOutcome, RecordToken};
use mokly_sidecar::compiled::{CompiledGeneration, ReuseEvidence};
use mokly_sidecar::durable_recipe::DurableRecipe;
use mokly_sidecar::methods::Bundle;
use mokly_sidecar::reusable_recipe::ReusableRecipe;

pub mod paused;

/// Counts the shared first-lookup announcement.
#[derive(Default)]
pub struct Notices(pub AtomicUsize);

impl Reporter for Notices {
    fn opened(&self, _path: &Path) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }
}

/// Compose an isolated host cache without starting a sidecar.
pub fn cache(root: PathBuf) -> DiskCache {
    let cancellation = Arc::new(Token::default());
    DiskCache {
        root: root.clone(),
        source_bytes: 1,
        dependency_bytes: 1,
        storage: Arc::new(SystemStorage {
            root,
            cancellation: cancellation.clone(),
            flush: Arc::new(SystemFlush),
        }),
        locks: Arc::new(SystemLocks),
        clock: Arc::new(SystemClock::default()),
        cancellation,
        reporter: Arc::new(Notices::default()),
    }
}

/// Settings for one independent disk entry.
pub fn params(entry: &str) -> Bundle {
    Bundle {
        vite: false,
        vite_inputs: None,
        evaluation: None,
        entry_files: vec![entry.into()],
        renderer: None,
        stories_files: vec![],
        module_resolution: Default::default(),
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
    }
}

/// A small complete compilation with distinct code and runtime identities.
pub fn recipe(params: Bundle, code: &str) -> DurableRecipe {
    DurableRecipe::new(
        ReusableRecipe::new(
            code.into(),
            params,
            Default::default(),
            Arc::new(CompiledGeneration {
                toolchain: "fixture".into(),
                metadata_identity: None,
                reuse_evidence: Arc::new(ReuseEvidence {
                    uncaptured: None,
                    durable: true,
                    complete: true,
                    inputs: Default::default(),
                }),
                unmapped_dependency_directories: None,
                identity: code.into(),
                code: code.into(),
                vite: None,
                runtime_key: format!("runtime:{code}"),
                dependency_roots: vec![],
                css_modules: vec![],
                sources: Default::default(),
                peers: Default::default(),
                inputs: Default::default(),
                metadata_inputs: Default::default(),
                input_directories: Default::default(),
                metadata_directories: Default::default(),
            }),
        )
        .unwrap(),
    )
    .unwrap()
}

/// One place for the cache layout used by filesystem fixtures.
pub fn entry(cache: &DiskCache, params: &Bundle) -> PathBuf {
    raw_entry(cache, &settings_key(params).unwrap())
}

/// One raw entry directory in the product namespace.
pub fn raw_entry(cache: &DiskCache, key: &str) -> PathBuf {
    cache.root.join("bundles/entries").join(key)
}

/// The single payload file of one entry.
pub fn data(entry: &Path) -> PathBuf {
    entry.join("data/bundle.json")
}

/// The bounded completion receipt of one entry.
pub fn receipt(entry: &Path) -> PathBuf {
    entry.join("receipt.json")
}

/// The fixed stripe of an already validated SHA-256 key.
pub fn stripe(cache: &DiskCache, key: &str) -> PathBuf {
    cache
        .root
        .join("bundles/locks")
        .join(format!("stripe-{}.lock", &key[..2]))
}

/// Read code and publication identity from an asserted successful load.
pub fn loaded(value: ReadOutcome) -> (String, RecordToken) {
    let ReadOutcome::Hit { recipe, token, .. } = value else {
        panic!("expected a loaded recipe: {value:?}")
    };
    (recipe.compiled().code.clone(), token)
}

/// Create a sparse prior publication through the product's receipt writer.
pub fn sparse(cache: &DiskCache, key: &str, bytes: u64, used: u64) {
    let entry = raw_entry(cache, key);
    cache.storage.prepare(&entry.join("data")).unwrap();
    fs::File::create(data(&entry))
        .unwrap()
        .set_len(bytes)
        .unwrap();
    cache
        .storage
        .bundle_receipt(
            &entry,
            &BundleReceipt {
                bytes: bytes + 1024,
                used,
                publication: RecordToken::new([used as u8; 32]),
                runtime_digest: [3; 32],
            },
            true,
        )
        .unwrap();
}
