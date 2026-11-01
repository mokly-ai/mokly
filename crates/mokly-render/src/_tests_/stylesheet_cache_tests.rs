//! Oversized stylesheet results remain usable without retention in either cache.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};

use mokly_css::types::{Bundle, StylesheetBundler, StylesheetBundlerMock, StylesheetRoot};
use unimock::{MockFn, Unimock, matching};

use crate::stylesheet_cache::CachedStylesheets;
use crate::stylesheet_store::StylesheetCache;

#[test]
fn oversized_results_are_returned_but_recomputed_on_the_next_request() {
    let bundle = Bundle {
        read_evidence: Default::default(),
        route: "styles/main.css".into(),
        css: "a {color:red}".into(),
        assets: BTreeMap::new(),
        css_modules: BTreeMap::new(),
        inputs: BTreeMap::new(),
        imported_by: BTreeMap::new(),
        repository_aliases: BTreeSet::new(),
        dependency_digests: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: Vec::new(),
    };
    let compiler: &dyn StylesheetBundler = &CachedStylesheets::new(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(bundle.clone())))
                .n_times(2),
        )),
        Arc::new(Unimock::new(())),
        "/repo".into(),
        "test".into(),
        Arc::new(Mutex::new(StylesheetCache::new(1))),
    );
    let root = StylesheetRoot {
        path: "main.css".into(),
        stylesheets: vec!["main.css".into()],
        excluded: BTreeSet::new(),
        local_css: true,
    };
    assert_eq!(compiler.bundle(&root).unwrap().css, "a {color:red}");
    assert_eq!(compiler.bundle(&root).unwrap().css, "a {color:red}");
}
