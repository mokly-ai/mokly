//! Replacement generations retain only public files of unchanged documents.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_graph::cache::MemoryCache;
use mokly_graph::public_inputs::{ClosureInputs, MemoryClosureInputs};
use tempfile::TempDir;

#[expect(
    dead_code,
    reason = "shared graph fixture support has helpers for other test binaries"
)]
mod support;

const ROUTE: &str = "home/index.mobile.html";
const PUBLIC_FILE: &str = "assets/public.svg";

fn fixture() -> TempDir {
    let root = TempDir::new().unwrap();
    fs::create_dir_all(root.path().join("specs")).unwrap();
    fs::create_dir_all(root.path().join("assets")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<img src=\"../../assets/public.svg\">",
    )
    .unwrap();
    fs::write(
        root.path().join(PUBLIC_FILE),
        "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    )
    .unwrap();
    root
}

fn render_first(
    root: &Path,
) -> (
    mokly_graph::delivery_inputs::DeliveryInputs,
    Arc<dyn mokly_graph::types::RenderGeneration>,
) {
    let inputs = mokly_graph::delivery_inputs::DeliveryInputs::default();
    let first = support::prepare_with_inputs(root, 0, 1, inputs.clone())
        .0
        .unwrap();
    first.render(ROUTE).unwrap();
    assert!(first.contains_public_file(PUBLIC_FILE));
    (inputs, first)
}

#[test]
fn unchanged_documents_carry_public_files_without_rendering() {
    let root = fixture();
    let (inputs, _first) = render_first(root.path());
    let replacement = support::prepare_with_inputs(root.path(), 0, 1, inputs)
        .0
        .unwrap();

    assert!(replacement.contains_public_file(PUBLIC_FILE));
}

#[test]
fn replacement_sees_a_render_completed_after_preparation() {
    let root = fixture();
    let inputs = mokly_graph::delivery_inputs::DeliveryInputs::default();
    let original = support::prepare_with_inputs(root.path(), 0, 1, inputs.clone())
        .0
        .unwrap();
    let replacement = support::prepare_with_inputs(root.path(), 0, 1, inputs)
        .0
        .unwrap();
    assert_eq!(original.plans()[ROUTE].key, replacement.plans()[ROUTE].key);
    assert!(!replacement.contains_public_file(PUBLIC_FILE));

    original.render(ROUTE).unwrap();

    assert!(replacement.contains_public_file(PUBLIC_FILE));
    assert!(replacement.public_files().contains(PUBLIC_FILE));
}

#[test]
fn changed_documents_do_not_carry_their_old_public_files() {
    let root = fixture();
    let (inputs, _first) = render_first(root.path());
    let carried = support::prepare_with_inputs(root.path(), 0, 1, inputs.clone())
        .0
        .unwrap();
    assert!(carried.contains_public_file(PUBLIC_FILE));
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Changed\n---\n<img src=\"../../assets/public.svg\">",
    )
    .unwrap();
    let replacement = support::prepare_with_inputs(root.path(), 0, 1, inputs)
        .0
        .unwrap();

    assert!(!replacement.contains_public_file(PUBLIC_FILE));
    assert!(!replacement.public_files().contains(PUBLIC_FILE));
}

#[test]
fn denied_files_are_not_carried_into_a_replacement() {
    let root = fixture();
    let (inputs, _first) = render_first(root.path());
    let carried = support::prepare_with_inputs(root.path(), 0, 1, inputs.clone())
        .0
        .unwrap();
    assert!(carried.contains_public_file(PUBLIC_FILE));
    let replacement = support::prepare_with_cache_and_output(
        root.path(),
        Arc::new(MemoryCache::new(0)),
        1,
        inputs,
        Some(&root.path().join("assets")),
    )
    .0
    .unwrap();
    assert_eq!(carried.plans()[ROUTE].key, replacement.plans()[ROUTE].key);

    assert!(!replacement.contains_public_file(PUBLIC_FILE));
    assert!(!replacement.public_files().contains(PUBLIC_FILE));
}

#[test]
fn final_key_release_removes_only_its_files_from_both_indexes() {
    let records = MemoryClosureInputs::default();
    let first = BTreeSet::from(["first".into()]);
    let second = BTreeSet::from(["second".into()]);
    records.retain("first");
    records.retain("first");
    records.retain("second");
    records.record("first", PUBLIC_FILE);
    records.record("first", PUBLIC_FILE);
    records.record("first", "assets/first-only.svg");
    records.record("second", PUBLIC_FILE);
    assert!(records.contains(PUBLIC_FILE, &first));
    assert!(records.contains(PUBLIC_FILE, &second));
    assert!(!records.contains("assets/first-only.svg", &second));

    records.release("first");
    assert!(records.contains(PUBLIC_FILE, &first));
    records.release("first");
    assert!(records.paths("first").is_empty());
    assert!(!records.contains(PUBLIC_FILE, &first));
    assert!(!records.contains("assets/first-only.svg", &first));
    assert!(records.contains(PUBLIC_FILE, &second));
    records.release("second");
    assert!(records.paths("second").is_empty());
    assert!(!records.contains(PUBLIC_FILE, &second));
    records.retain("first");
    assert!(!records.contains(PUBLIC_FILE, &first));
    records.release("first");
}
