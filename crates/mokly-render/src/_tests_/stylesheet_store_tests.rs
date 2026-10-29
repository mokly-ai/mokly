//! The store charges each context entry once and remembers why it lost a record.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use mokly_css::types::Bundle;
use mokly_model::material::digest;
use mokly_source_interface::read_evidence::{ReadBaseline, ReadEvidence};
use unimock::Unimock;

use crate::source_paths::SOURCE_INPUT_PREFIX;
use crate::stylesheet_record::{ContextEvidence, Record};
use crate::stylesheet_store::{Miss, StylesheetCache};

const MODULE: &str = "node_modules/plugin/index.js";

fn bundle(name: &str, module: &str) -> Bundle {
    let mut evidence = ReadEvidence::default();
    evidence.insert(module.into(), ReadBaseline::Late("0".repeat(64)));
    evidence.insert(
        format!("{SOURCE_INPUT_PREFIX}{name}"),
        ReadBaseline::Late("1".repeat(64)),
    );
    Bundle {
        read_evidence: evidence,
        route: format!("styles/{name}"),
        css: "a{color:red}".into(),
        assets: BTreeMap::new(),
        css_modules: BTreeMap::new(),
        inputs: BTreeMap::new(),
        imported_by: BTreeMap::new(),
        repository_aliases: BTreeSet::new(),
        dependency_digests: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: Vec::new(),
    }
}

/// A record whose module evidence uses `context` when given, or a new entry.
fn record(name: &str, module: &str, context: Option<&Arc<ContextEvidence>>) -> Arc<Record> {
    stored(bundle(name, module), context)
}

fn stored(bundle: Bundle, context: Option<&Arc<ContextEvidence>>) -> Arc<Record> {
    let tree = Unimock::new(());
    let root = Path::new("/repo");
    Arc::new(Record::new(
        &tree,
        root,
        bundle,
        |digest, evidence| match context {
            Some(context) => context.clone(),
            None => Arc::new(ContextEvidence::with_base(
                &tree, root, digest, evidence, None,
            )),
        },
    ))
}

fn context(record: &Record) -> Arc<ContextEvidence> {
    record.context.clone().unwrap()
}

fn key_bytes(key: &str) -> usize {
    size_of::<String>() + key.len()
}

#[test]
fn a_key_without_a_record_misses_with_no_record() {
    assert_eq!(StylesheetCache::default().miss("a"), Miss::NoRecord);
}

#[test]
fn records_that_share_a_context_entry_charge_it_once() {
    let first = record("a.css", MODULE, None);
    let shared = context(&first);
    let second = record("b.css", MODULE, Some(&shared));
    let mut store = StylesheetCache::new(
        key_bytes("a") + key_bytes("b") + first.bytes + second.bytes + shared.bytes,
    );
    store.insert("a".into(), first);
    store.insert("b".into(), second);
    assert!(store.record("a").is_some());
    assert!(store.record("b").is_some());
    assert!(Arc::ptr_eq(
        &store.context(&shared.digest).unwrap(),
        &shared
    ));
}

#[test]
fn a_separate_entry_with_equal_evidence_is_charged_again() {
    let first = record("a.css", MODULE, None);
    let second = record("b.css", MODULE, None);
    assert_eq!(context(&first).digest, context(&second).digest);
    let limit =
        key_bytes("a") + key_bytes("b") + first.bytes + second.bytes + context(&first).bytes;
    let mut store = StylesheetCache::new(limit);
    store.insert("a".into(), first);
    store.insert("b".into(), second);
    assert!(store.record("a").is_none());
    assert_eq!(store.miss("a"), Miss::Evicted);
    assert!(store.record("b").is_some());
}

#[test]
fn a_record_that_does_not_fit_removes_the_others_and_their_keys_miss_with_evicted() {
    let first = record("a.css", "node_modules/a/index.js", None);
    let second = record("b.css", "node_modules/b/index.js", None);
    let limit = key_bytes("a")
        + key_bytes("b")
        + first.bytes
        + second.bytes
        + context(&first).bytes
        + context(&second).bytes;
    let mut store = StylesheetCache::new(limit - 1);
    store.insert("a".into(), first);
    store.insert("b".into(), second.clone());
    assert!(store.record("a").is_none());
    assert_eq!(store.miss("a"), Miss::Evicted);
    assert!(store.record("b").is_some());
    assert!(store.context(&context(&second).digest).is_some());
}

#[test]
fn a_record_larger_than_the_bound_misses_with_evicted() {
    let first = record("a.css", MODULE, None);
    let mut store = StylesheetCache::new(first.bytes);
    store.insert("a".into(), first);
    assert!(store.record("a").is_none());
    assert_eq!(store.miss("a"), Miss::Evicted);
}

#[test]
fn finding_6_a_key_capacity_counts_toward_the_store_bound() {
    let first = record("a.css", MODULE, None);
    let shared = context(&first);
    let mut key = String::with_capacity(128);
    key.push('a');
    assert!(key.capacity() > key.len());
    let key_bytes = size_of::<String>() + key.capacity();
    let limit = key_bytes + first.bytes + shared.bytes;
    let mut store = StylesheetCache::new(limit - 1);
    let lookup = key.clone();

    store.insert(key, first);

    assert!(store.record(&lookup).is_none());
    assert_eq!(store.miss(&lookup), Miss::Evicted);
    assert!(store.retained() < limit);
}

#[test]
fn finding_2_a_long_miss_key_charges_its_digest_and_keeps_full_lookup() {
    let first = record("a.css", MODULE, None);
    let key = "a".repeat(4096);
    let digest = mokly_model::material::digest(key.as_bytes());
    let reason = size_of::<(String, Miss)>() + digest.capacity();
    let mut store = StylesheetCache::new(first.bytes + reason);

    store.insert(key.clone(), first);

    assert_eq!(store.miss(&key), Miss::Evicted);
    assert_eq!(store.retained(), reason);
}

#[test]
fn finding_3_store_charges_a_context_chain_once_per_entry() {
    let first = record("a.css", "module-a.js", None);
    let base = context(&first);
    let tree = Unimock::new(());
    let root = Path::new("/repo");
    let mut modules = ReadEvidence::default();
    modules.insert("module-a.js".into(), ReadBaseline::Late("0".repeat(64)));
    modules.insert("module-b.js".into(), ReadBaseline::Late("1".repeat(64)));
    let full_digest = digest(format!("{:?}", modules.inputs).as_bytes());
    let delta = Arc::new(ContextEvidence::with_base(
        &tree,
        root,
        full_digest,
        modules,
        Some(base.clone()),
    ));
    let second = stored(bundle("b.css", "module-a.js"), Some(&delta));
    let limit =
        key_bytes("a") + key_bytes("b") + first.bytes + second.bytes + base.bytes + delta.bytes;
    let mut store = StylesheetCache::new(limit);

    store.insert("a".into(), first);
    store.insert("b".into(), second);

    assert!(store.record("a").is_some());
    assert!(store.record("b").is_some());
    assert!(store.retained() <= limit);
}

#[test]
fn a_rejected_key_misses_with_inconsistent_evidence_until_a_record_replaces_it() {
    let mut store = StylesheetCache::default();
    store.insert("a".into(), record("a.css", MODULE, None));
    store.reject("a".into());
    assert!(store.record("a").is_none());
    assert_eq!(store.miss("a"), Miss::InconsistentEvidence);
    store.insert("a".into(), record("a.css", MODULE, None));
    assert!(store.record("a").is_some());
    assert_eq!(store.miss("a"), Miss::NoRecord);
}

#[test]
fn the_store_drops_a_context_entry_that_no_record_uses() {
    let first = record("a.css", "node_modules/a/index.js", None);
    let digest = context(&first).digest.clone();
    let mut store = StylesheetCache::default();
    store.insert("a".into(), first);
    store.insert("a".into(), record("a.css", "node_modules/b/index.js", None));
    assert!(store.context(&digest).is_none());
}

#[test]
fn miss_reasons_that_do_not_fit_beside_the_records_are_forgotten() {
    let first = record("a.css", MODULE, None);
    let charge = key_bytes("b") + first.bytes + context(&first).bytes;
    let mut store = StylesheetCache::new(charge);
    store.insert("b".into(), first);
    store.reject("a".into());
    assert_eq!(store.miss("a"), Miss::NoRecord);
    assert!(store.record("b").is_some());
}

#[test]
fn a_record_that_fits_only_without_its_held_context_entry_stays_out() {
    let first = record("a.css", MODULE, None);
    let shared = context(&first);
    let mut larger = bundle("b.css", MODULE);
    larger.css.push_str(&"b{color:blue}".repeat(8));
    let second = stored(larger, Some(&shared));
    let reason = size_of::<(String, Miss)>() + mokly_model::material::digest(b"b").capacity();
    let limit = key_bytes("a") + first.bytes + shared.bytes + reason;
    assert!(second.bytes < limit);
    assert!(key_bytes("b") + second.bytes + shared.bytes > limit);
    let mut store = StylesheetCache::new(limit);
    store.insert("a".into(), first);
    store.insert("b".into(), second);
    assert!(store.retained() <= limit);
    assert!(store.record("a").is_some());
    assert!(store.record("b").is_none());
    assert_eq!(store.miss("b"), Miss::Evicted);
}
