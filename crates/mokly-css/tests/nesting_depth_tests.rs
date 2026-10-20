//! The deepest authored CSS that each parser survives on a 2 MiB worker stack.
//!
//! A child-process search finds each limit for the current build profile and
//! prints it. Mokly's scanners reach the search cap. lightningcss, and every
//! pipeline that calls it, stops at a limit that depends on the nesting form.

use std::collections::BTreeSet;
use std::sync::Arc;

use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use mokly_css::compiler::Compiler;
use mokly_css::resolver::SourceResolver;
use mokly_css::rules::ParsedCss;
use mokly_css::types::{IdentityProcessor, StylesheetBundler, StylesheetRoot};
use mokly_css::{modules, rule_collection, syntax};
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

mod depth_search;

use depth_search::{Probe, search};

const CHILD: &str = "depth_probe_child";
/// Mokly's scanners keep nesting on the heap; the search stops here.
const MOKLY_CAP: usize = 100_000;
/// lightningcss limits are far below this cap in every build profile.
const LIBRARY_CAP: usize = 10_000;
/// Far above authored CSS nesting, with margin for other platforms' frames.
const SURVIVED: usize = 32;

fn nested(open: &str, inner: &str, close: &str, depth: usize) -> String {
    format!("{}{inner}{}", open.repeat(depth), close.repeat(depth))
}

fn rules(depth: usize) -> String {
    nested(".a{", "color:red", "}", depth)
}

fn parses(source: &str) {
    let sheet = StyleSheet::parse(source, ParserOptions::default()).unwrap();
    assert_eq!(sheet.rules.0.len(), 1);
}

fn lightningcss_rules(depth: usize) {
    parses(&rules(depth));
}

fn lightningcss_media(depth: usize) {
    parses(&nested("@media all{", ".a{color:red}", "}", depth));
}

fn lightningcss_selectors(depth: usize) {
    parses(&format!(
        "{}{{color:red}}",
        nested(":is(", ".a", ")", depth)
    ));
}

fn lightningcss_values(depth: usize) {
    parses(&format!(".a{{--x:{}}}", nested("f(", "1", ")", depth)));
}

fn references(depth: usize) {
    let value = nested("f(", "url(\"deep.svg\")", ")", depth);
    let references = syntax::references(&format!(".a{{--x:{value}}}"));
    assert_eq!(references.len(), 1);
    assert_eq!(references[0].value, "deep.svg");
}

fn module_scope(depth: usize) {
    let (css, exports) = modules::scope("deep.module.css", &rules(depth)).unwrap();
    assert_eq!(exports.len(), 1);
    assert!(css.contains("color:red"));
}

fn rule_collection(depth: usize) {
    let ParsedCss::Rules(rules) = rule_collection::collect(rules(depth).as_bytes()) else {
        panic!("the nested rules did not parse");
    };
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].declarations, "color:red");
}

/// Compile and bundle one stylesheet root, as Serve delivers it.
fn bundle(path: &str, text: String) -> String {
    let bytes = text.into_bytes();
    let project = SourceTreeMock::project
        .each_call(matching!(_))
        .answers_arc(Arc::new(|_, path| {
            Ok(Some(Node {
                identity: path.into(),
                lexical_kind: FileKind::File,
                kind: FileKind::File,
            }))
        }));
    let read = SourceTreeMock::read
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, _| Ok(bytes.clone())));
    let tree = Arc::new(Unimock::new((project, read)));
    let compiler = Compiler {
        tree: tree.clone(),
        repo_root: "/repo".into(),
        resolver: Arc::new(SourceResolver {
            settings: Default::default(),
            tree,
            repo_root: "/repo".into(),
        }),
        processor: Arc::new(IdentityProcessor),
    };
    let root = StylesheetRoot {
        path: path.into(),
        stylesheets: vec![path.into()],
        excluded: BTreeSet::new(),
        local_css: true,
    };
    compiler.bundle(&root).unwrap().css
}

fn stylesheet_bundle(depth: usize) {
    assert!(bundle("deep.css", rules(depth)).contains("color: red"));
}

fn module_bundle(depth: usize) {
    assert!(bundle("deep.module.css", rules(depth)).contains("color: red"));
}

const PROBES: &[Probe] = &[
    ("lightningcss_rules", lightningcss_rules),
    ("lightningcss_media", lightningcss_media),
    ("lightningcss_selectors", lightningcss_selectors),
    ("lightningcss_values", lightningcss_values),
    ("references", references),
    ("module_scope", module_scope),
    ("rule_collection", rule_collection),
    ("stylesheet_bundle", stylesheet_bundle),
    ("module_bundle", module_bundle),
];

#[test]
#[ignore = "a child process of the depth searches below runs this probe"]
fn depth_probe_child() {
    depth_search::run_child(PROBES);
}

#[test]
fn mokly_reference_scanner_reaches_the_search_cap() {
    assert_eq!(search(CHILD, "references", MOKLY_CAP).depth, MOKLY_CAP);
}

#[test]
fn lightningcss_forms_survive_authored_nesting() {
    for name in [
        "lightningcss_rules",
        "lightningcss_media",
        "lightningcss_selectors",
        "lightningcss_values",
    ] {
        let limit = search(CHILD, name, LIBRARY_CAP);
        assert!(limit.depth >= SURVIVED, "{name}: {limit:?}");
    }
}

#[test]
fn css_pipelines_survive_authored_nesting() {
    for name in [
        "module_scope",
        "rule_collection",
        "stylesheet_bundle",
        "module_bundle",
    ] {
        let limit = search(CHILD, name, LIBRARY_CAP);
        assert!(limit.depth >= SURVIVED, "{name}: {limit:?}");
    }
}
