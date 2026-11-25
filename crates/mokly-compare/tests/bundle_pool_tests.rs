//! New pools and real sidecars reuse one temporary disk entry across source changes.

use std::fs;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_sidecar::bundle_outcomes::CacheOutcome;
use mokly_sidecar::compiled::UncapturedEvidence;
use mokly_sidecar::pool::SidecarPool;
use mokly_test_support::durable_fixture::{self, Owner};

use self::bundle_pool::{
    Counts, bundle, cache_snapshot, capture_flags, edit, edit_fingerprint, exclusive_sidecars, pool,
};
use self::bundle_pool_observations::first_evidence_difference;

#[path = "../../../tests/rust/package_version.rs"]
mod package_version;

#[expect(
    dead_code,
    reason = "cache composition is shared with the other integration tests"
)]
mod support;

#[path = "support/bundle_pool.rs"]
mod bundle_pool;

#[path = "support/bundle_pool_observations.rs"]
mod bundle_pool_observations;

#[path = "support/bundle_pool_trace.rs"]
mod bundle_pool_trace;

#[test]
fn a_warm_inexact_compilation_supplies_the_first_edit_plan_with_one_attempt_and_equal_output() {
    let _sidecars = exclusive_sidecars();
    let temporary = durable_fixture::create(Owner::CompareWarmPlan).unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let source = root.join("source");
    let cache = root.join("cache");
    fs::create_dir(&source).unwrap();
    fs::create_dir(&cache).unwrap();
    fs::write(source.join("package.json"), "{}").unwrap();
    fs::write(
        source.join("tsconfig.json"),
        r#"{"compilerOptions":{"strict":true}}"#,
    )
    .unwrap();
    fs::write(source.join("entry.ts"), "export {value} from './value.ts';").unwrap();
    fs::write(source.join("value.ts"), "export const value='original';").unwrap();
    let first_counts = Arc::new(Counts::default());
    let first = pool(&source, &cache, first_counts.clone());
    let captured = bundle(&first, &source);
    assert_eq!(first_counts.0.load(Ordering::SeqCst), 2);
    assert_eq!(captured.plan.as_ref().unwrap().imports.len(), 2);
    first.shutdown().unwrap();
    let counts = Arc::new(Counts::default());
    let warm = pool(&source, &cache, counts.clone());
    let accepted = bundle(&warm, &source);
    assert_eq!(
        accepted.cache,
        Some(CacheOutcome::Hit),
        "initial capture: {}; warm capture: {}; first unequal captured input: {}; cache: {}",
        capture_flags(&captured),
        capture_flags(&accepted),
        first_evidence_difference(
            &captured.compiled.reuse_evidence,
            &accepted.compiled.reuse_evidence
        ),
        cache_snapshot(&cache)
    );
    assert_eq!(accepted.compiled.runtime_key, captured.compiled.runtime_key);
    assert_eq!(accepted.plan, captured.plan);
    assert_eq!(counts.0.load(Ordering::SeqCst), 0);
    fs::write(source.join("value.ts"), "export const value='edited';").unwrap();
    let planned = edit(&warm, &source, accepted.plan);
    assert_eq!(counts.0.load(Ordering::SeqCst), 1);
    assert_eq!(
        planned.compiled.reuse_evidence.uncaptured,
        Some(UncapturedEvidence::ServeEdit)
    );
    assert_eq!(planned.plan, None);
    let oracle_counts = Arc::new(Counts::default());
    let oracle = pool(&source, &cache, oracle_counts.clone());
    let native = edit(&oracle, &source, None);
    assert_eq!(oracle_counts.0.load(Ordering::SeqCst), 2);
    assert_eq!(edit_fingerprint(planned), edit_fingerprint(native));
    oracle.shutdown().unwrap();
    warm.shutdown().unwrap();
}

#[test]
fn fresh_sidecars_skip_esbuild_and_changed_inputs_replace_the_disk_recipe() {
    let _sidecars = exclusive_sidecars();
    let temporary = durable_fixture::create(Owner::CompareRecipeReplacement).unwrap();
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
    assert_eq!(
        final_bundle.cache,
        Some(CacheOutcome::Hit),
        "initial capture: {}; changed capture: {}; final capture: {}; first unequal captured input: {}; cache: {}",
        capture_flags(&original),
        capture_flags(&changed),
        capture_flags(&final_bundle),
        first_evidence_difference(
            &changed.compiled.reuse_evidence,
            &final_bundle.compiled.reuse_evidence
        ),
        cache_snapshot(&cache)
    );
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

#[test]
fn restarted_disk_recipes_reject_an_added_earlier_absolute_paths_target() {
    let _sidecars = exclusive_sidecars();
    let temporary = durable_fixture::create(Owner::CompareAbsolutePaths).unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let source = root.join("source");
    let cache = root.join("cache");
    fs::create_dir_all(source.join("one")).unwrap();
    fs::create_dir_all(source.join("two")).unwrap();
    fs::create_dir(&cache).unwrap();
    fs::write(source.join("package.json"), "{}").unwrap();
    fs::write(source.join("one/.keep"), "").unwrap();
    fs::write(source.join("two/value.js"), "export const value='two';").unwrap();
    let written = source
        .join("written.js")
        .to_string_lossy()
        .replace('\\', "/");
    fs::write(
        source.join("entry.ts"),
        format!(
            "export {{value}} from {};",
            serde_json::to_string(&written).unwrap()
        ),
    )
    .unwrap();
    fs::write(
        source.join("tsconfig.json"),
        serde_json::to_vec(&serde_json::json!({
            "compilerOptions": { "paths": { written: ["./one/value.js", "./two/value.js"] } }
        }))
        .unwrap(),
    )
    .unwrap();
    let first_counts = Arc::new(Counts::default());
    let first = pool(&source, &cache, first_counts.clone());
    let original = bundle(&first, &source);
    assert_eq!(
        original
            .modules
            .iter()
            .map(|module| module.path.as_str())
            .collect::<Vec<_>>(),
        ["entry.ts", "two/value.js"]
    );
    assert_eq!(first_counts.0.load(Ordering::SeqCst), 1);
    first.shutdown().unwrap();
    let warm_counts = Arc::new(Counts::default());
    let warm = pool(&source, &cache, warm_counts.clone());
    let unchanged = bundle(&warm, &source);
    assert_eq!(unchanged.cache, Some(CacheOutcome::Hit));
    assert_eq!(warm_counts.0.load(Ordering::SeqCst), 0);
    warm.shutdown().unwrap();
    fs::write(source.join("one/value.js"), "export const value='one';").unwrap();
    let counts = Arc::new(Counts::default());
    let restarted = pool(&source, &cache, counts.clone());
    let changed = bundle(&restarted, &source);
    assert_eq!(
        changed
            .modules
            .iter()
            .map(|module| module.path.as_str())
            .collect::<Vec<_>>(),
        ["entry.ts", "one/value.js"]
    );
    assert_eq!(changed.cache, Some(CacheOutcome::StampMismatch));
    assert_eq!(counts.0.load(Ordering::SeqCst), 1);
    restarted.shutdown().unwrap();
}
