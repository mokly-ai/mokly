//! Uncovered CSS Modules still compile individually after the first root pass.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::types::{Bundle, StylesheetBundlerMock};
use mokly_sidecar::methods;
use unimock::{MockFn, Unimock, matching};

use crate::render_environment::ClassMaps;
use crate::stylesheet_class_maps::ClassMapsMock;

#[test]
fn covered_modules_are_skipped_and_only_the_uncovered_module_gets_a_local_root() {
    let covered: ClassMaps = BTreeMap::from([(
        "covered.module.css".into(),
        BTreeMap::from([("covered".into(), "scoped-covered".into())]),
    )]);
    let uncovered: ClassMaps = BTreeMap::from([(
        "orphan.module.css".into(),
        BTreeMap::from([("orphan".into(), "scoped-orphan".into())]),
    )]);
    let expected = covered
        .iter()
        .chain(&uncovered)
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<BTreeMap<_, _>>();
    let compiler = Unimock::new((
        ClassMapsMock::class_maps
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, roots, _| {
                assert_eq!(roots.len(), 1);
                assert_eq!(roots[0].path, "entry.ts");
                assert_eq!(roots[0].stylesheets, ["covered.module.css"]);
                Ok(covered.clone())
            })),
        StylesheetBundlerMock::bundle
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, root| {
                assert_eq!(root.path, "orphan.module.css");
                assert_eq!(root.stylesheets, ["orphan.module.css"]);
                assert!(root.local_css);
                assert!(root.excluded.is_empty());
                Ok(Bundle {
                    resolution_files: Default::default(),
                    resolution_roots: Default::default(),
                    read_evidence: Default::default(),
                    route: String::new(),
                    css: String::new(),
                    assets: Default::default(),
                    css_module_named_exports: Default::default(),
                    css_modules: uncovered.clone(),
                    inputs: Default::default(),
                    imported_by: Default::default(),
                    repository_aliases: Default::default(),
                    dependency_digests: Default::default(),
                    plugin_inputs: Default::default(),
                    directories: Vec::new(),
                })
            })),
    ));
    let params = methods::Bundle {
        evaluation: None,
        entry_files: vec!["entry.ts".into()],
        renderer: None,
        stories_files: vec![],
        storybook_folders: Default::default(),
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        vite: false,
        vite_inputs: None,
    };
    let modules = BTreeMap::from([
        ("entry.ts".into(), vec!["covered.module.css".into()]),
        ("covered.module.css".into(), vec![]),
        ("orphan.module.css".into(), vec![]),
    ]);
    assert_eq!(
        super::prepare(&compiler, &modules, &params, &BTreeMap::new())
            .unwrap()
            .maps,
        expected
    );
}
