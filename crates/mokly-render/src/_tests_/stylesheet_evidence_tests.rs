//! Both stylesheet caches replay original evidence and reject incompatible reuse.

use std::collections::{BTreeMap, BTreeSet};
use std::io::Cursor;
use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_css::types::{Bundle, StylesheetBundler, StylesheetBundlerMock, StylesheetRoot};
use mokly_model::material::digest;
use mokly_source_interface::read_evidence::{ReadBaseline, ReadEvidence};
use mokly_source_interface::stream::{OpenedSource, SourceStream};
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::source_paths::SOURCE_INPUT_PREFIX;
use crate::stylesheet_cache::CachedStylesheets;
use crate::stylesheet_store::StylesheetCache;

fn bundle() -> Bundle {
    let mut evidence = ReadEvidence::default();
    evidence.insert(
        "tokens.txt".into(),
        ReadBaseline::ObservedWholeFile("old".into()),
    );
    Bundle {
        read_evidence: evidence,
        route: "styles/main.css".into(),
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

/// The same evidence on the root's own input, which every delivery replays.
fn own_bundle() -> Bundle {
    let mut bundle = bundle();
    let versions = bundle.read_evidence.inputs.remove("tokens.txt");
    bundle.read_evidence.inputs.insert(
        format!("{SOURCE_INPUT_PREFIX}tokens.txt"),
        versions.unwrap_or_default(),
    );
    bundle
}

fn root() -> StylesheetRoot {
    StylesheetRoot {
        path: "main.css".into(),
        stylesheets: vec!["main.css".into()],
        excluded: BTreeSet::new(),
        local_css: true,
    }
}

#[test]
fn local_and_shared_cache_hits_replay_original_witnesses_without_a_second_transform() {
    let witnesses = Arc::new(Mutex::new(Vec::new()));
    let recorded = witnesses.clone();
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::observe_inputs
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, path, baselines| {
                recorded.lock().unwrap().extend(
                    baselines
                        .iter()
                        .map(|baseline| (path.to_owned(), baseline.clone())),
                );
                Ok(())
            })),
        SourceTreeMock::digest
            .next_call(matching!(_))
            .returns(Ok("old".into())),
    )));
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = CachedStylesheets::new(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .next_call(matching!(_))
                .returns(Ok(own_bundle())),
        )),
        tree.clone(),
        "/repo".into(),
        "same".into(),
        shared.clone(),
    );
    let second = CachedStylesheets::new(
        Arc::new(Unimock::new(())),
        tree,
        "/repo".into(),
        "same".into(),
        shared,
    );
    for compiler in [&first, &first, &second] {
        let result = compiler.bundle(&root()).unwrap();
        assert_eq!(result.css, "a{color:red}");
        assert_eq!(result.read_evidence, own_bundle().read_evidence);
    }
    let records = witnesses.lock().unwrap();
    assert_eq!(records.len(), 3);
    assert!(records.iter().all(|(path, baseline)| path
        == Path::new("/repo/node_modules/.mokly-roots/source/tokens.txt")
        && *baseline == ReadBaseline::ObservedWholeFile("old".into())));
}

#[test]
fn conflicting_observed_and_late_versions_cannot_seed_cross_generation_reuse() {
    let mut old = bundle();
    old.read_evidence
        .insert("tokens.txt".into(), ReadBaseline::Late("new".into()));
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = CachedStylesheets::new(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .next_call(matching!(_))
                .returns(Ok(old)),
        )),
        Arc::new(Unimock::new(())),
        "/repo".into(),
        "same".into(),
        shared.clone(),
    );
    let mut fresh = bundle();
    fresh.css = "a{color:blue}".into();
    let second = CachedStylesheets::new(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .next_call(matching!(_))
                .returns(Ok(fresh)),
        )),
        Arc::new(Unimock::new(())),
        "/repo".into(),
        "same".into(),
        shared,
    );
    assert_eq!(first.bundle(&root()).unwrap().css, "a{color:red}");
    assert_eq!(second.bundle(&root()).unwrap().css, "a{color:blue}");
}

#[test]
fn ranged_cache_results_keep_their_late_whole_file_stamp_and_original_ranges() {
    let bytes = b"prefix-old-tail";
    let whole = digest(bytes);
    let mut observed = bundle();
    observed.read_evidence.inputs.clear();
    observed
        .read_evidence
        .insert("tokens.txt".into(), ReadBaseline::Late(whole.clone()));
    observed.read_evidence.insert(
        "tokens.txt".into(),
        ReadBaseline::ObservedRange {
            identity: None,
            offset: 7,
            length: 3,
            eof: false,
            digest: digest(b"old"),
        },
    );
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::open_stream
            .next_call(matching!(_))
            .answers(&|_, _| {
                let source: Box<dyn SourceStream> = Box::new(OpenedSource {
                    length: 15,
                    reader: Box::new(Cursor::new(b"prefix-old-tail")),
                });
                Ok(source)
            }),
        SourceTreeMock::digest
            .next_call(matching!(_))
            .returns(Ok(whole)),
    )));
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = CachedStylesheets::new(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .next_call(matching!(_))
                .returns(Ok(observed.clone())),
        )),
        tree.clone(),
        "/repo".into(),
        "same".into(),
        shared.clone(),
    );
    let second = CachedStylesheets::new(
        Arc::new(Unimock::new(())),
        tree,
        "/repo".into(),
        "same".into(),
        shared,
    );
    for compiler in [&first, &first, &second] {
        assert_eq!(
            compiler.bundle(&root()).unwrap().read_evidence,
            observed.read_evidence
        );
    }
}
